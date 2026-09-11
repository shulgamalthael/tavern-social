import { create } from 'zustand';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { acceptSubscriptionRequest } from '../api/accept-subscription-request';
import { getSubscriptionRequests } from '../api/get-subscription-requests';
import { respondToSubscriptionRequest } from '../api/respond-to-subscription-request';
import type { SubscriptionRequestPreview } from './types';

interface FollowRequestsState {
  incoming: SubscriptionRequestPreview[];
  outgoing: SubscriptionRequestPreview[];
  status: AsyncStatus;
  error: string | null;
}

interface FollowRequestsActions {
  loadRequests: () => Promise<void>;
  acceptRequest: (senderId: string) => Promise<void>;
  removeRequest: (userId: string) => Promise<void>;
  /** Приходит из Socket.IO (`app/home-app.tsx`) — тот же приём, что
   * `useFriendStore`'s `receiveNewRequest`/`receiveAccepted`/`receiveRemoved`
   * (см. AGENTS.md, раздел про real-time): данные перечитываются из REST,
   * payload события используется только для тоста. */
  receiveNewRequest: () => void;
  receiveAccepted: () => void;
  receiveRemoved: () => void;
}

export type FollowRequestsStore = FollowRequestsState & FollowRequestsActions;

/**
 * Заявки на подписку к приватному профилю (§103) — отдельный store от
 * `useFriendStore`, хоть и структурно идентичный: `entities/follow` и
 * `entities/friend` — разные сущности (см. `model/types.ts`'s комментарий),
 * заводить здесь зависимость на чужой слайс нельзя. Список друзей/подписчиков
 * сюда не входит — только заявки, ждущие решения (показываются вторым блоком
 * на вкладке «Заявки» в `widgets/friends/FriendsWidget`, должны жить
 * независимо от того, смонтирован ли этот виджет).
 */
export const useFollowRequestsStore = create<FollowRequestsStore>((set, get) => ({
  incoming: [],
  outgoing: [],
  status: 'idle',
  error: null,
  loadRequests: async () => {
    set({ status: 'loading', error: null });
    try {
      const { incoming, outgoing } = await getSubscriptionRequests();
      set({ incoming, outgoing, status: 'success' });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Не удалось загрузить заявки',
      });
    }
  },
  acceptRequest: async (senderId) => {
    await acceptSubscriptionRequest(senderId);
    await get().loadRequests();
  },
  removeRequest: async (userId) => {
    await respondToSubscriptionRequest(userId);
    await get().loadRequests();
  },
  receiveNewRequest: () => void get().loadRequests(),
  receiveAccepted: () => void get().loadRequests(),
  receiveRemoved: () => void get().loadRequests(),
}));

/** Счётчик входящих заявок на подписку — тот же приём, что
 * `selectPendingIncomingRequestsCount` у `entities/friend`. */
export function selectPendingIncomingSubscriptionRequestsCount(state: FollowRequestsStore): number {
  return state.incoming.length;
}
