import { create } from 'zustand';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { getNotifications } from '../api/get-notifications';
import { getUnreadNotificationsCount } from '../api/get-unread-notifications-count';
import { markAllNotificationsRead } from '../api/mark-all-notifications-read';
import { markNotificationRead } from '../api/mark-notification-read';
import type { Notification } from './types';

interface NotificationState {
  items: Notification[];
  nextCursor: string | null;
  status: AsyncStatus;
  error: string | null;
  loadMoreStatus: AsyncStatus;
  unreadCount: number;
}

interface NotificationActions {
  loadFirstPage: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  /** Приходит из Socket.IO (`app/home-app.tsx`) — список страницы уведомлений
   * всегда перечитывается через `loadFirstPage` при открытии, поэтому здесь
   * достаточно оптимистично увеличить счётчик, не патча `items`. */
  receiveRealtimeUnread: () => void;
}

export type NotificationStore = NotificationState & NotificationActions;

/**
 * Уведомления о взаимодействиях с контентом — общий store, а не `useAsyncData`
 * внутри `NotificationsWidget`: счётчик в шапке должен обновляться в реальном
 * времени, даже когда сама страница уведомлений не смонтирована (см.
 * AGENTS.md, раздел 4).
 */
export const useNotificationStore = create<NotificationStore>((set, get) => ({
  items: [],
  nextCursor: null,
  status: 'idle',
  error: null,
  loadMoreStatus: 'idle',
  unreadCount: 0,
  loadFirstPage: async () => {
    set({ status: 'loading', error: null });
    try {
      const { items, nextCursor } = await getNotifications();
      set({ items, nextCursor, status: 'success' });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Не удалось загрузить уведомления',
      });
    }
  },
  loadMore: async () => {
    const { nextCursor, loadMoreStatus, status } = get();
    if (!nextCursor || loadMoreStatus === 'loading' || status !== 'success') return;

    set({ loadMoreStatus: 'loading' });
    try {
      const page = await getNotifications(nextCursor);
      set((state) => ({
        items: [...state.items, ...page.items],
        nextCursor: page.nextCursor,
        loadMoreStatus: 'success',
      }));
    } catch {
      set({ loadMoreStatus: 'error' });
    }
  },
  loadUnreadCount: async () => {
    const unreadCount = await getUnreadNotificationsCount().catch(() => get().unreadCount);
    set({ unreadCount });
  },
  markRead: async (id) => {
    const wasUnread = get().items.find((item) => item.id === id)?.isRead === false;
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
      unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    }));
    await markNotificationRead(id).catch(() => undefined);
  },
  markAllRead: async () => {
    set((state) => ({
      items: state.items.map((item) => ({ ...item, isRead: true })),
      unreadCount: 0,
    }));
    await markAllNotificationsRead().catch(() => undefined);
  },
  receiveRealtimeUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
}));
