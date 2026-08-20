import { create } from 'zustand';
import type { SectionId } from './types';

interface NavigationState {
  section: SectionId;
  isMoreSheetOpen: boolean;
  /** Чужой профиль, который сейчас просматриваем в разделе `profile` — `null`
   * значит «свой профиль». Сбрасывается любым переходом через `goToSection`,
   * чтобы не залипал при переключении в другой раздел и обратно. */
  viewedUserId: string | null;
}

interface NavigationActions {
  goToSection: (section: SectionId) => void;
  goToUserProfile: (userId: string) => void;
  openMoreSheet: () => void;
  closeMoreSheet: () => void;
  toggleMoreSheet: () => void;
}

export type NavigationStore = NavigationState & NavigationActions;

/**
 * Раздел приложения и состояние мобильного листа «Ещё» — используются
 * одновременно Header, десктопным доком и мобильной панелью, поэтому это
 * общий store, а не локальный useState одного из виджетов.
 */
export const useNavigationStore = create<NavigationStore>((set) => ({
  section: 'feed',
  isMoreSheetOpen: false,
  viewedUserId: null,
  goToSection: (section) => set({ section, isMoreSheetOpen: false, viewedUserId: null }),
  goToUserProfile: (userId) =>
    set({ section: 'profile', isMoreSheetOpen: false, viewedUserId: userId }),
  openMoreSheet: () => set({ isMoreSheetOpen: true }),
  closeMoreSheet: () => set({ isMoreSheetOpen: false }),
  toggleMoreSheet: () => set((state) => ({ isMoreSheetOpen: !state.isMoreSheetOpen })),
}));
