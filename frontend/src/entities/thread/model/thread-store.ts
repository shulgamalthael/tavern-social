import { create } from 'zustand';
import { getInitials } from '@/shared/lib/get-initials';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { addParticipant as addParticipantAction } from '../api/add-participant';
import { displayNameFor } from '../api/map-thread';
import { getOrCreateDirectThread } from '../api/get-or-create-direct-thread';
import { getThreads } from '../api/get-threads';
import { markThreadRead } from '../api/mark-thread-read';
import { sendMessage as sendMessageAction } from '../api/send-message';
import type { ChatMessage, Thread } from './types';

interface ThreadState {
  threads: Thread[];
  status: AsyncStatus;
  error: string | null;
  /** Какой диалог открыт в мессенджере — общее состояние: нужно и мессенджеру, и
   * кнопке «Написать» на карточке друга, чтобы открыть конкретный диалог. */
  activeThreadId: string | null;
}

interface ThreadActions {
  loadThreads: () => Promise<void>;
  sendMessage: (threadId: string, text: string) => Promise<void>;
  setActiveThread: (threadId: string | null) => void;
  /** Находит или создаёт диалог с пользователем и делает его активным — вызывается из FriendCard. */
  openDirectThreadWith: (userId: string) => Promise<void>;
  markRead: (threadId: string) => Promise<void>;
  /** Добавляет собеседника в уже открытый диалог — вызывается из
   * `AddParticipantDropdown` в хедере мессенджера. Всегда дописывает
   * участника в тот же `threadId`, новый диалог не создаётся ни при первом,
   * ни при последующих добавлениях. */
  addParticipant: (threadId: string, userId: string) => Promise<void>;
  /** Приходит из Socket.IO-шлюза в реальном времени — см. `use-thread-socket.ts`. */
  receiveMessage: (threadId: string, message: ChatMessage) => void;
  /** Кто-то добавил участника в диалог, который уже есть в сторе — если
   * диалога ещё нет (это я — новый участник), честно перечитываем список
   * через REST, а не пытаемся собрать диалог из одного сигнала. */
  receiveParticipantAdded: (threadId: string, participant: { id: string; name: string }) => void;
}

export type ThreadStore = ThreadState & ThreadActions;

/** Список диалогов нужен и Header (счётчик непрочитанных), и мессенджеру. */
export const useThreadStore = create<ThreadStore>((set, get) => ({
  threads: [],
  status: 'idle',
  error: null,
  activeThreadId: null,
  loadThreads: async () => {
    set({ status: 'loading', error: null });
    try {
      const threads = await getThreads();
      set({ threads, status: 'success' });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Не удалось загрузить сообщения',
      });
    }
  },
  sendMessage: async (threadId, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const message = await sendMessageAction(threadId, trimmed);
    set((state) => ({
      threads: state.threads.map((thread) =>
        thread.id === threadId
          ? { ...thread, messages: [...thread.messages, message], unread: undefined }
          : thread,
      ),
    }));
  },
  setActiveThread: (threadId) => {
    set({ activeThreadId: threadId });
    if (threadId) void get().markRead(threadId);
  },
  openDirectThreadWith: async (userId) => {
    // Только строго 1:1-диалог с этим человеком — групповой диалог, в
    // котором он тоже состоит, не подходит: «Написать» с карточки друга
    // должно открывать личную переписку, а не первую попавшуюся группу.
    const existing = get().threads.find(
      (thread) => !thread.isGroup && thread.participants[0]?.id === userId,
    );
    if (existing) {
      get().setActiveThread(existing.id);
      return;
    }

    const thread = await getOrCreateDirectThread(userId);
    set((state) => ({ threads: [thread, ...state.threads] }));
    get().setActiveThread(thread.id);
  },
  markRead: async (threadId) => {
    set((state) => ({
      threads: state.threads.map((thread) =>
        thread.id === threadId ? { ...thread, unread: undefined } : thread,
      ),
    }));
    await markThreadRead(threadId).catch(() => undefined);
  },
  addParticipant: async (threadId, userId) => {
    // Возвращённый диалог — не обязательно тот же `threadId`: если исходный
    // диалог был 1:1, backend не мутирует личную переписку, а создаёт новый
    // групповой Thread (см. `ThreadsService.addParticipant`) — тогда его
    // здесь ещё нет, дописываем в начало списка, а не ищем по старому id.
    const thread = await addParticipantAction(threadId, userId);
    set((state) => {
      const exists = state.threads.some((existing) => existing.id === thread.id);
      return {
        threads: exists
          ? state.threads.map((existing) => (existing.id === thread.id ? thread : existing))
          : [thread, ...state.threads],
      };
    });
    get().setActiveThread(thread.id);
  },
  receiveParticipantAdded: (threadId, participant) => {
    const hasThread = get().threads.some((thread) => thread.id === threadId);
    if (!hasThread) {
      // Диалога ещё нет локально — значит, добавили меня самого, и у меня
      // нет базового объекта диалога, чтобы просто дописать участника.
      void get().loadThreads();
      return;
    }
    set((state) => ({
      threads: state.threads.map((thread) => {
        if (thread.id !== threadId) return thread;
        if (thread.participants.some((existing) => existing.id === participant.id)) return thread;
        const participants = [
          ...thread.participants,
          { id: participant.id, name: participant.name, initials: getInitials(participant.name) },
        ];
        const name = displayNameFor(participants);
        return { ...thread, participants, isGroup: true, name, initials: getInitials(name) };
      }),
    }));
  },
  receiveMessage: (threadId, message) => {
    set((state) => {
      const isOpen = state.activeThreadId === threadId;
      return {
        threads: state.threads.map((thread) => {
          if (thread.id !== threadId) return thread;
          // Reconnect-catchup (`loadThreads()` на `connect`) и live-событие
          // могут доставить одно и то же сообщение дважды — id спасает.
          if (thread.messages.some((existing) => existing.id === message.id)) return thread;
          return {
            ...thread,
            messages: [...thread.messages, message],
            unread: isOpen ? undefined : (thread.unread ?? 0) + 1,
          };
        }),
      };
    });
    if (get().activeThreadId === threadId) {
      void markThreadRead(threadId).catch(() => undefined);
    }
  },
}));

export function selectUnreadThreadCount(state: ThreadStore): number {
  return state.threads.reduce((total, thread) => total + (thread.unread ?? 0), 0);
}
