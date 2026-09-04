import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { FavoriteItem } from './types';

interface FavoriteState {
  /** Тот же смысл и та же причина, что у `CartState.businessId`
   * (`entities/cart/model/cart-store.ts`) — один браузер, разные витрины
   * Таверны за один день, избранное не должно перепутаться между ними. */
  businessId: string | null;
  items: FavoriteItem[];
  isOpen: boolean;
}

interface FavoriteActions {
  ensureBusiness: (businessId: string) => void;
  toggle: (item: FavoriteItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  open: () => void;
  closePanel: () => void;
}

export type FavoriteStore = FavoriteState & FavoriteActions;

/**
 * Избранное посетителя витрины — анонимное, `localStorage`, зеркало
 * `useCartStore` (`entities/cart/model/cart-store.ts`) по структуре и
 * назначению каждого поля: тот же `businessId`-скоуп, тот же эфемерный
 * `isOpen` (не персистится, см. `partialize`), потому что кнопка «Избранное»
 * в шапке сайта (`HeaderActions.tsx`) должна открывать одну и ту же панель
 * независимо от того, с какой карточки товара/услуги её открыли.
 */
export const useFavoriteStore = create<FavoriteStore>()(
  persist(
    (set) => ({
      businessId: null,
      items: [],
      isOpen: false,

      ensureBusiness: (businessId) =>
        set((state) => (state.businessId === businessId ? state : { businessId, items: [] })),

      toggle: (item) =>
        set((state) => {
          const exists = state.items.some((entry) => entry.id === item.id);
          return {
            items: exists
              ? state.items.filter((entry) => entry.id !== item.id)
              : [...state.items, item],
          };
        }),

      remove: (id) => set((state) => ({ items: state.items.filter((entry) => entry.id !== id) })),

      clear: () => set({ items: [] }),

      open: () => set({ isOpen: true }),
      closePanel: () => set({ isOpen: false }),
    }),
    {
      name: 'tavern-favorites',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ businessId: state.businessId, items: state.items }),
    },
  ),
);

/** Параметризованный селектор (тот же приём, что рекомендует AGENTS.md для
 * производных значений) — `FavoriteButton.tsx` подписывается только на факт
 * «этот конкретный id уже в избранном», не на весь массив `items`, чтобы
 * добавление ДРУГОГО товара не перерендеривало каждую карточку на странице. */
export function selectIsFavorite(id: string) {
  return (state: FavoriteStore) => state.items.some((entry) => entry.id === id);
}

export function selectFavoriteCount(state: FavoriteStore): number {
  return state.items.length;
}
