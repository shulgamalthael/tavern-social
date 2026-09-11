import { create } from 'zustand';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { acceptFriendRequest } from '../api/accept-friend-request';
import { getFriendRequests } from '../api/get-friend-requests';
import { getFriends } from '../api/get-friends';
import { removeFriend as removeFriendAction } from '../api/remove-friend';
import { respondToFriendRequest } from '../api/respond-to-friend-request';
import { sendFriendRequest } from '../api/send-friend-request';
import type { Friend, FriendRequestPreview } from './types';

interface FriendState {
  friends: Friend[];
  status: AsyncStatus;
  error: string | null;
  /** Курсор следующей страницы списка друзей — `null` значит «дальше нет»
   * (см. `loadMoreFriends`, `shared/lib/use-infinite-scroll`). */
  nextCursor: string | null;
  loadMoreStatus: AsyncStatus;
  incoming: FriendRequestPreview[];
  outgoing: FriendRequestPreview[];
  requestsStatus: AsyncStatus;
  requestsError: string | null;
}

interface FriendActions {
  loadFriends: () => Promise<void>;
  loadMoreFriends: () => Promise<void>;
  loadRequests: () => Promise<void>;
  sendRequest: (userId: string) => Promise<void>;
  acceptRequest: (senderId: string) => Promise<void>;
  removeRequest: (userId: string) => Promise<void>;
  /** Разрыв уже подтверждённой дружбы — не путать с `removeRequest` (отмена/
   * отклонение ещё не подтверждённой заявки). Убирает из `friends` локально,
   * не через `loadFriends`: полная перезагрузка сбросила бы уже пролистанные
   * страницы курсорной пагинации обратно к первой. */
  removeFriend: (friendId: string) => Promise<void>;
  /** Приходит из Socket.IO (`app/home-app.tsx`) — просто сигнал «что-то
   * изменилось», данные всегда перечитываются из REST, а не патчатся из
   * payload'а события (см. AGENTS.md, раздел про real-time). */
  receiveNewRequest: () => void;
  receiveAccepted: () => void;
  receiveRemoved: () => void;
  /** Разорвали дружбу с моей стороны — в отличие от `receiveRemoved`
   * (отменённая/отклонённая заявка), это пассивное фоновое событие у
   * получателя, полная перезагрузка списка здесь не проблема (см. AGENTS.md,
   * раздел про real-time). */
  receiveFriendRemoved: () => void;
}

export type FriendStore = FriendState & FriendActions;

/**
 * Список друзей и заявок в друзья — общий store, а не `useAsyncData` внутри
 * `FriendsWidget`: с появлением real-time событий (`friend-request:*`) эти
 * данные должны обновляться, даже пока `FriendsWidget` не смонтирован (см.
 * `AGENTS.md`, раздел 4 — «должно жить независимо от того, смонтирован ли
 * компонент»). `UserProfileView` в этот store не пишет — его кнопка
 * «Добавить в друзья» отражает статус только относительно одного конкретного
 * профиля, а не общий список заявок.
 */
export const useFriendStore = create<FriendStore>((set, get) => ({
  friends: [],
  status: 'idle',
  error: null,
  nextCursor: null,
  loadMoreStatus: 'idle',
  incoming: [],
  outgoing: [],
  requestsStatus: 'idle',
  requestsError: null,
  loadFriends: async () => {
    set({ status: 'loading', error: null });
    try {
      const { friends, nextCursor } = await getFriends();
      set({ friends, nextCursor, status: 'success', loadMoreStatus: 'idle' });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Не удалось загрузить друзей',
      });
    }
  },
  loadMoreFriends: async () => {
    const { nextCursor, loadMoreStatus, status } = get();
    if (!nextCursor || loadMoreStatus === 'loading' || status !== 'success') return;

    set({ loadMoreStatus: 'loading' });
    try {
      const { friends, nextCursor: newCursor } = await getFriends(nextCursor);
      set((state) => ({
        friends: [...state.friends, ...friends],
        nextCursor: newCursor,
        loadMoreStatus: 'success',
      }));
    } catch {
      set({ loadMoreStatus: 'error' });
    }
  },
  loadRequests: async () => {
    set({ requestsStatus: 'loading', requestsError: null });
    try {
      const { incoming, outgoing } = await getFriendRequests();
      set({ incoming, outgoing, requestsStatus: 'success' });
    } catch (error) {
      set({
        requestsStatus: 'error',
        requestsError: error instanceof Error ? error.message : 'Не удалось загрузить заявки',
      });
    }
  },
  sendRequest: async (userId) => {
    await sendFriendRequest(userId);
    await get().loadRequests();
  },
  acceptRequest: async (senderId) => {
    await acceptFriendRequest(senderId);
    await Promise.all([get().loadRequests(), get().loadFriends()]);
  },
  removeRequest: async (userId) => {
    await respondToFriendRequest(userId);
    await get().loadRequests();
  },
  removeFriend: async (friendId) => {
    await removeFriendAction(friendId);
    set((state) => ({ friends: state.friends.filter((friend) => friend.id !== friendId) }));
  },
  receiveNewRequest: () => void get().loadRequests(),
  receiveAccepted: () => {
    void get().loadRequests();
    void get().loadFriends();
  },
  receiveRemoved: () => void get().loadRequests(),
  receiveFriendRemoved: () => void get().loadFriends(),
}));

/** Счётчик для бейджа на пункте «Друзья» в навигации (`NavigationDock`) —
 * тот же приём, что и `selectUnreadThreadCount` у `entities/thread`:
 * простой производный селектор поверх уже загруженных данных, а не
 * отдельное инкрементируемое поле в сторе (в отличие от `useNotification
 * Store.unreadCount`) — `incoming` и так обновляется целиком при каждом
 * real-time событии (см. `receiveNewRequest`/`receiveAccepted`/
 * `receiveRemoved` выше), заводить второй источник правды незачем. */
export function selectPendingIncomingRequestsCount(state: FriendStore): number {
  return state.incoming.length;
}
