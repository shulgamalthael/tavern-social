import { create } from 'zustand';
import { getInitials } from '@/shared/lib/get-initials';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { addParticipant as addParticipantAction } from '../api/add-participant';
import { deleteMessage as deleteMessageAction } from '../api/delete-message';
import { editMessage as editMessageAction } from '../api/edit-message';
import { forwardMessage as forwardMessageAction } from '../api/forward-message';
import { displayNameFor } from '../api/map-thread';
import { getOrCreateDirectThread } from '../api/get-or-create-direct-thread';
import { getThreads } from '../api/get-threads';
import { markThreadRead } from '../api/mark-thread-read';
import {
  pinMessage as pinMessageAction,
  unpinMessage as unpinMessageAction,
} from '../api/pin-message';
import { sendMessage as sendMessageAction } from '../api/send-message';
import type { ChatMessage, Thread, ThreadParticipant } from './types';

/** Замена сообщения по id — используется и при редактировании (свой ответ
 * REST), и при `message:edited` (чужой ответ по сокету) — оба сценария
 * должны обновить сообщение и в `messages`, и в `pinnedMessages`, если оно
 * там тоже есть (закреплённое сообщение можно редактировать). */
function replaceMessage(thread: Thread, updated: ChatMessage): Thread {
  const replaceIn = (messages: ChatMessage[]) =>
    messages.map((message) => (message.id === updated.id ? updated : message));
  return {
    ...thread,
    messages: replaceIn(thread.messages),
    pinnedMessages: replaceIn(thread.pinnedMessages),
  };
}

/** Убирает сообщение по id — используется и при своём удалении (REST), и
 * при `message:deleted` (чужое удаление по сокету), тем же приёмом, что и
 * `replaceMessage` — обе коллекции сразу, закреплённое сообщение можно
 * удалить. */
function removeMessage(thread: Thread, messageId: string): Thread {
  const removeFrom = (messages: ChatMessage[]) =>
    messages.filter((message) => message.id !== messageId);
  return {
    ...thread,
    messages: removeFrom(thread.messages),
    pinnedMessages: removeFrom(thread.pinnedMessages),
  };
}

interface ThreadState {
  threads: Thread[];
  status: AsyncStatus;
  error: string | null;
  /** Какой диалог открыт в мессенджере — общее состояние: нужно и мессенджеру, и
   * кнопке «Написать» на карточке друга, чтобы открыть конкретный диалог. */
  activeThreadId: string | null;
  /** Собеседник, с которым чат открыт в UI, но реального `Thread` на backend
   * ещё нет — заводится не раньше первого отправленного сообщения (см.
   * `sendMessage`), чтобы просто открытие переписки с незнакомым человеком
   * (без единого сообщения) не создавало у него в списке диалогов пустую
   * запись. Открытие уже существующего диалога (в т.ч. с другом) минует
   * черновик полностью — см. `openDirectThreadWith`. */
  draftTarget: ThreadParticipant | null;
  /** Сообщение, которое сейчас редактируется в композере — `null`, если
   * композер в обычном режиме отправки (см. `features/send-message/ui/
   * MessageComposer.tsx`). */
  editingMessage: { threadId: string; messageId: string; text: string } | null;
  /** Сообщение, на которое сейчас готовится ответ — баннер-цитата над полем
   * ввода (см. `MessageComposer.tsx`). Взаимоисключающе с `editingMessage`:
   * начало одного отменяет другое, как в большинстве чатов. */
  replyingTo: {
    threadId: string;
    messageId: string;
    senderName: string;
    text: string;
    hasAttachment: boolean;
  } | null;
}

interface ThreadActions {
  loadThreads: () => Promise<void>;
  /** `threadId: null` — отправка из черновика (см. `draftTarget`): диалог
   * создаётся прямо здесь, вместе с первым сообщением, а не заранее.
   * `files` — вложения (картинки/файлы до 5 МБ каждый, см. `SendMessageDto`
   * на backend). `replyToId` — id сообщения, на которое отвечают (см.
   * `replyingTo`), только для уже существующего треда — из черновика
   * ответить не на что. */
  sendMessage: (
    threadId: string | null,
    text: string,
    files?: File[],
    replyToId?: string,
  ) => Promise<void>;
  setActiveThread: (threadId: string | null) => void;
  /** Открывает диалог с пользователем — существующий делает активным сразу,
   * для нового переходит в режим черновика (`draftTarget`), без запроса к
   * backend и без создания диалога, пока не отправлено первое сообщение.
   * Не требует дружбы — написать можно кому угодно (см. `FriendCard`,
   * `UserProfileView`). */
  openDirectThreadWith: (target: ThreadParticipant) => void;
  markRead: (threadId: string) => Promise<void>;
  /** Добавляет собеседника в уже открытый диалог — вызывается из
   * `AddParticipantDropdown` в хедере мессенджера. Всегда дописывает
   * участника в тот же `threadId`, новый диалог не создаётся ни при первом,
   * ни при последующих добавлениях. */
  addParticipant: (threadId: string, userId: string) => Promise<void>;
  startEditingMessage: (threadId: string, messageId: string, text: string) => void;
  cancelEditingMessage: () => void;
  editMessage: (threadId: string, messageId: string, text: string) => Promise<void>;
  /** Своё сообщение, необратимо — backend это же и проверяет. Убирает
   * сообщение из `messages`/`pinnedMessages` сразу после успешного ответа
   * REST, без ожидания своего же socket-эха (см. `receiveMessage`,
   * self-echo фильтруется по `senderId` — на удаление такого фильтра нет,
   * поэтому обновляем стор сами, а не ждём событие). */
  deleteMessage: (threadId: string, messageId: string) => Promise<void>;
  startReplyingToMessage: (
    threadId: string,
    messageId: string,
    senderName: string,
    text: string,
    hasAttachment: boolean,
  ) => void;
  cancelReplyingToMessage: () => void;
  /** Пересылает сообщение в другой (уже существующий) тред — новую запись
   * дописывает в `messages` целевого треда, если он у меня уже загружен. */
  forwardMessage: (
    sourceThreadId: string,
    messageId: string,
    targetThreadId: string,
  ) => Promise<void>;
  pinMessage: (threadId: string, messageId: string) => Promise<void>;
  unpinMessage: (threadId: string, messageId: string) => Promise<void>;
  /** Приходит из Socket.IO-шлюза в реальном времени — см. `use-thread-socket.ts`. */
  receiveMessage: (threadId: string, message: ChatMessage) => void;
  /** `message:edited` — чужое отредактированное сообщение. */
  receiveMessageEdit: (threadId: string, message: ChatMessage) => void;
  /** `message:deleted` — чужое (или своё с другой вкладки) удаление. */
  receiveMessageDeleted: (threadId: string, messageId: string) => void;
  /** `thread:pinned-changed` — кто-то (в т.ч. я с другой вкладки) закрепил/
   * открепил сообщение; backend присылает уже готовый актуальный `Thread`
   * целиком, здесь только заменить его в списке. */
  receiveThreadUpdate: (thread: Thread) => void;
  /** Кто-то добавил участника в диалог, который уже есть в сторе — если
   * диалога ещё нет (это я — новый участник), честно перечитываем список
   * через REST, а не пытаемся собрать диалог из одного сигнала. */
  receiveParticipantAdded: (
    threadId: string,
    participant: { id: string; name: string; avatarUrl: string | null },
  ) => void;
}

export type ThreadStore = ThreadState & ThreadActions;

/** Список диалогов нужен и Header (счётчик непрочитанных), и мессенджеру. */
export const useThreadStore = create<ThreadStore>((set, get) => ({
  threads: [],
  status: 'idle',
  error: null,
  activeThreadId: null,
  draftTarget: null,
  editingMessage: null,
  replyingTo: null,
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
  sendMessage: async (threadId, text, files = [], replyToId) => {
    const trimmed = text.trim();
    if (!trimmed && files.length === 0) return;

    if (threadId) {
      const message = await sendMessageAction(threadId, trimmed, files, replyToId);
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === threadId
            ? { ...thread, messages: [...thread.messages, message], unread: undefined }
            : thread,
        ),
        replyingTo: null,
      }));
      return;
    }

    // Черновик (см. `draftTarget`) — диалога ещё нет нигде, кроме UI этой
    // вкладки. Заводим его именно сейчас, вместе с первым сообщением, а не
    // раньше — до этого момента у собеседника не должно появиться ни одной
    // записи о переписке.
    const target = get().draftTarget;
    if (!target) return;
    const thread = await getOrCreateDirectThread(target.id);
    const message = await sendMessageAction(thread.id, trimmed, files);
    set((state) => ({
      threads: [{ ...thread, messages: [...thread.messages, message] }, ...state.threads],
      activeThreadId: thread.id,
      draftTarget: null,
    }));
  },
  setActiveThread: (threadId) => {
    // Явный выбор активного диалога (в т.ч. `null` — закрытие чата) всегда
    // выигрывает у незавершённого черновика и незаконченного редактирования/ответа.
    set({
      activeThreadId: threadId,
      draftTarget: null,
      editingMessage: null,
      replyingTo: null,
    });
    if (threadId) void get().markRead(threadId);
  },
  openDirectThreadWith: (target) => {
    // Только строго 1:1-диалог с этим человеком — групповой диалог, в
    // котором он тоже состоит, не подходит: «Написать» с карточки друга
    // должно открывать личную переписку, а не первую попавшуюся группу.
    const existing = get().threads.find(
      (thread) => !thread.isGroup && thread.participants[0]?.id === target.id,
    );
    if (existing) {
      get().setActiveThread(existing.id);
      return;
    }

    // Ни запроса к backend, ни записи в БД — только локальный черновик,
    // пока не отправлено первое сообщение (см. `sendMessage`).
    set({ activeThreadId: null, draftTarget: target });
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
  startEditingMessage: (threadId, messageId, text) => {
    set({ editingMessage: { threadId, messageId, text }, replyingTo: null });
  },
  cancelEditingMessage: () => {
    set({ editingMessage: null });
  },
  editMessage: async (threadId, messageId, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const message = await editMessageAction(threadId, messageId, trimmed);
    set((state) => ({
      threads: state.threads.map((thread) =>
        thread.id === threadId ? replaceMessage(thread, message) : thread,
      ),
      editingMessage: null,
    }));
  },
  deleteMessage: async (threadId, messageId) => {
    await deleteMessageAction(threadId, messageId);
    set((state) => ({
      threads: state.threads.map((thread) =>
        thread.id === threadId ? removeMessage(thread, messageId) : thread,
      ),
    }));
  },
  startReplyingToMessage: (threadId, messageId, senderName, text, hasAttachment) => {
    set({
      replyingTo: { threadId, messageId, senderName, text, hasAttachment },
      editingMessage: null,
    });
  },
  cancelReplyingToMessage: () => {
    set({ replyingTo: null });
  },
  forwardMessage: async (sourceThreadId, messageId, targetThreadId) => {
    const message = await forwardMessageAction(sourceThreadId, messageId, targetThreadId);
    set((state) => ({
      threads: state.threads.map((thread) =>
        thread.id === targetThreadId
          ? { ...thread, messages: [...thread.messages, message], unread: undefined }
          : thread,
      ),
    }));
  },
  pinMessage: async (threadId, messageId) => {
    const thread = await pinMessageAction(threadId, messageId);
    set((state) => ({
      threads: state.threads.map((existing) => (existing.id === threadId ? thread : existing)),
    }));
  },
  unpinMessage: async (threadId, messageId) => {
    const thread = await unpinMessageAction(threadId, messageId);
    set((state) => ({
      threads: state.threads.map((existing) => (existing.id === threadId ? thread : existing)),
    }));
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
          {
            id: participant.id,
            name: participant.name,
            initials: getInitials(participant.name),
            avatarUrl: participant.avatarUrl,
          },
        ];
        const name = displayNameFor(participants);
        return {
          ...thread,
          participants,
          isGroup: true,
          name,
          initials: getInitials(name),
          // Стало групповым (2+ участника) — единого аватара больше нет.
          avatarUrl: null,
        };
      }),
    }));
  },
  receiveMessage: (threadId, message) => {
    if (!get().threads.some((thread) => thread.id === threadId)) {
      // Первое сообщение от того, с кем раньше не переписывались (диалог
      // создан только что, на стороне отправителя — см. `sendMessage`
      // выше) — у меня в сторе его ещё нет. Тот же приём, что и в
      // `receiveParticipantAdded`: честно перечитываем список через REST,
      // а не пытаемся собрать `Thread` из одного сигнала (в payload нет
      // даже имени/аватара собеседника — только текст сообщения).
      void get().loadThreads();
      return;
    }
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
  receiveMessageEdit: (threadId, message) => {
    set((state) => ({
      threads: state.threads.map((thread) =>
        thread.id === threadId ? replaceMessage(thread, message) : thread,
      ),
    }));
  },
  receiveMessageDeleted: (threadId, messageId) => {
    set((state) => ({
      threads: state.threads.map((thread) =>
        thread.id === threadId ? removeMessage(thread, messageId) : thread,
      ),
    }));
  },
  receiveThreadUpdate: (thread) => {
    const hasThread = get().threads.some((existing) => existing.id === thread.id);
    if (!hasThread) return;
    set((state) => ({
      threads: state.threads.map((existing) => (existing.id === thread.id ? thread : existing)),
    }));
  },
}));

export function selectUnreadThreadCount(state: ThreadStore): number {
  return state.threads.reduce((total, thread) => total + (thread.unread ?? 0), 0);
}
