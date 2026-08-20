import { create } from 'zustand';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { acceptFriendRequest } from '../api/accept-friend-request';
import { getFriendRequests } from '../api/get-friend-requests';
import { getFriends } from '../api/get-friends';
import { respondToFriendRequest } from '../api/respond-to-friend-request';
import { sendFriendRequest } from '../api/send-friend-request';
import type { Friend, FriendRequestPreview } from './types';

interface FriendState {
  friends: Friend[];
  status: AsyncStatus;
  error: string | null;
  incoming: FriendRequestPreview[];
  outgoing: FriendRequestPreview[];
  requestsStatus: AsyncStatus;
  requestsError: string | null;
}

interface FriendActions {
  loadFriends: () => Promise<void>;
  loadRequests: () => Promise<void>;
  sendRequest: (userId: string) => Promise<void>;
  acceptRequest: (senderId: string) => Promise<void>;
  removeRequest: (userId: string) => Promise<void>;
  /** Приходит из Socket.IO (`app/home-app.tsx`) — просто сигнал «что-то
   * изменилось», данные всегда перечитываются из REST, а не патчатся из
   * payload'а события (см. AGENTS.md, раздел про real-time). */
  receiveNewRequest: () => void;
  receiveAccepted: () => void;
  receiveRemoved: () => void;
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
  incoming: [],
  outgoing: [],
  requestsStatus: 'idle',
  requestsError: null,
  loadFriends: async () => {
    set({ status: 'loading', error: null });
    try {
      const friends = await getFriends();
      set({ friends, status: 'success' });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Не удалось загрузить друзей',
      });
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
  receiveNewRequest: () => void get().loadRequests(),
  receiveAccepted: () => {
    void get().loadRequests();
    void get().loadFriends();
  },
  receiveRemoved: () => void get().loadRequests(),
}));
