import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SectionId } from './types';

interface NavigationState {
  section: SectionId;
  /** Чужой профиль, который сейчас просматриваем в разделе `profile` — `null`
   * значит «свой профиль». Сбрасывается любым переходом через `goToSection`,
   * чтобы не залипал при переключении в другой раздел и обратно. */
  viewedUserId: string | null;
  /** Группа, которую сейчас просматриваем в разделе `groups` — `null` значит
   * «каталог групп». Тот же принцип, что и `viewedUserId`. */
  viewedGroupId: string | null;
}

interface NavigationActions {
  goToSection: (section: SectionId) => void;
  goToUserProfile: (userId: string) => void;
  goToGroup: (groupId: string) => void;
}

export type NavigationStore = NavigationState & NavigationActions;

/** Раздел приложения — общий для Header и `widgets/navigation-dock`, а не
 * локальный useState. Открыт ли попап «Ещё» в доке — локальное состояние
 * самого дока (как у дропдаунов в Header), сюда не выносится.
 *
 * `persist` в `sessionStorage` — при перезагрузке страницы пользователь
 * должен вернуться туда же, где был (см. AGENTS.md/задачу про сохранение
 * вкладки). `sessionStorage`, а не `localStorage`: «вернуться после
 * перезагрузки» — это про текущую вкладку браузера, а не «запомнить навсегда»
 * — закрыли вкладку/браузер, начали заново с ленты, как и раньше.
 * На сервере `sessionStorage` недоступен — `persist` сам не трогает storage
 * при SSR и молча остаётся на дефолте (`section: 'feed'`), подтягивая
 * сохранённое значение уже на клиенте после монтирования. */
export const useNavigationStore = create<NavigationStore>()(
  persist(
    (set) => ({
      section: 'feed',
      viewedUserId: null,
      viewedGroupId: null,
      goToSection: (section) => set({ section, viewedUserId: null, viewedGroupId: null }),
      goToUserProfile: (userId) => set({ section: 'profile', viewedUserId: userId }),
      goToGroup: (groupId) => set({ section: 'groups', viewedGroupId: groupId }),
    }),
    {
      name: 'tavern-navigation',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        section: state.section,
        viewedUserId: state.viewedUserId,
        viewedGroupId: state.viewedGroupId,
      }),
    },
  ),
);
