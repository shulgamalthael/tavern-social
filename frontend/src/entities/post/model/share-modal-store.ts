import { create } from 'zustand';

interface ShareModalState {
  /** id поста, который сейчас пересылают — `null`, когда модалка закрыта.
   * Единственный источник состояния: `PostCard` в любом виджете (лента,
   * своя/чужая стена, возможно сообщества) просто зовёт `openShareModal`,
   * рендерит саму модалку только `SharePostModal`, смонтированная один раз
   * в `app/home-app.tsx` (тот же приём, что `useToastStore`/
   * `NotificationToaster`) — без этого стора каждый виджет с `PostCard`
   * заводил бы свою копию состояния «открыта ли модалка», хотя открыта она
   * всегда ровно одна на всё приложение. */
  sharingPostId: string | null;
}

interface ShareModalActions {
  openShareModal: (postId: string) => void;
  closeShareModal: () => void;
}

export type ShareModalStore = ShareModalState & ShareModalActions;

export const useShareModalStore = create<ShareModalStore>((set) => ({
  sharingPostId: null,
  openShareModal: (postId) => set({ sharingPostId: postId }),
  closeShareModal: () => set({ sharingPostId: null }),
}));
