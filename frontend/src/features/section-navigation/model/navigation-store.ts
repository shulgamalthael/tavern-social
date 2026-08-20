import { create } from 'zustand';
import type { SectionId } from './types';

interface NavigationState {
  section: SectionId;
  /** Чужой профиль, который сейчас просматриваем в разделе `profile` — `null`
   * значит «свой профиль». Сбрасывается любым переходом через `goToSection`,
   * чтобы не залипал при переключении в другой раздел и обратно. */
  viewedUserId: string | null;
}

interface NavigationActions {
  goToSection: (section: SectionId) => void;
  goToUserProfile: (userId: string) => void;
}

export type NavigationStore = NavigationState & NavigationActions;

/** Раздел приложения — общий для Header и `widgets/navigation-dock`, а не
 * локальный useState. Открыт ли попап «Ещё» в доке — локальное состояние
 * самого дока (как у дропдаунов в Header), сюда не выносится. */
export const useNavigationStore = create<NavigationStore>((set) => ({
  section: 'feed',
  viewedUserId: null,
  goToSection: (section) => set({ section, viewedUserId: null }),
  goToUserProfile: (userId) => set({ section: 'profile', viewedUserId: userId }),
}));
