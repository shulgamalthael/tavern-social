import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartItem } from './types';

interface CartState {
  /** Сайт, которому принадлежит текущее содержимое корзины — один и тот же
   * браузер может за один день зайти на витрины двух РАЗНЫХ бизнесов
   * Таверны; без этого поля переключение сайта показало бы чужую корзину.
   * `null` — корзина ещё ни разу не инициализирована. */
  businessId: string | null;
  items: CartItem[];
  /** Открыта ли панель корзины (`CartWidget`'s модалка) — эфемерное UI-
   * состояние, НЕ персистится (см. `partialize` ниже, тот же принцип, что у
   * `selectedBlockId` в билдере: пережить перезагрузку страницы с открытой
   * корзиной было бы странно). Живёт в сторе, а не локальном `useState`
   * `CartWidget`, потому что открыть корзину должна уметь и кнопка в шапке
   * сайта (`HeaderActions.tsx`, вне дерева `CartWidget`), не только его
   * собственный плавающий `.fab`. */
  isOpen: boolean;
}

interface CartActions {
  /** Вызывается один раз при монтировании публичного сайта (`CartWidget`,
   * `ProductGridRenderer`) — если сохранённая корзина принадлежит ДРУГОМУ
   * бизнесу, очищает её перед использованием; если тому же — оставляет как
   * есть (посетитель может закрыть вкладку и вернуться, не потеряв корзину). */
  ensureBusiness: (businessId: string) => void;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  open: () => void;
  closePanel: () => void;
}

export type CartStore = CartState & CartActions;

/** `persist` в `localStorage`, не `sessionStorage` (сравните с `useNavigation
 * Store`) — корзина осмысленно переживает закрытие вкладки/браузера, в
 * отличие от «на каком разделе я был» (это про текущий визит). Единственный
 * стор на всё приложение (тот же принцип синглтона, что и у остальных
 * Zustand-сторов) — сценарий с двумя одновременно открытыми вкладками на
 * витрины РАЗНЫХ сайтов Таверны за раз считается редким и не поддерживается
 * (та вкладка, что смонтируется последней, вызовет `ensureBusiness` и
 * очистит корзину для своего бизнеса). */
export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      businessId: null,
      items: [],
      isOpen: false,

      open: () => set({ isOpen: true }),
      closePanel: () => set({ isOpen: false }),

      ensureBusiness: (businessId) =>
        set((state) => (state.businessId === businessId ? state : { businessId, items: [] })),

      addItem: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((entry) => entry.productId === item.productId);
          if (existing) {
            return {
              items: state.items.map((entry) =>
                entry.productId === item.productId
                  ? { ...entry, quantity: entry.quantity + quantity }
                  : entry,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity }] };
        }),

      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((entry) => entry.productId !== productId) })),

      setQuantity: (productId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((entry) => entry.productId !== productId)
              : state.items.map((entry) =>
                  entry.productId === productId ? { ...entry, quantity } : entry,
                ),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: 'tavern-cart',
      storage: createJSONStorage(() => localStorage),
      // `isOpen` — эфемерное UI-состояние (см. её комментарий в `CartState`),
      // не переживает перезагрузку страницы.
      partialize: (state) => ({ businessId: state.businessId, items: state.items }),
    },
  ),
);

/** Производные значения — отдельные селекторы, не пересчитываются в каждом
 * компоненте по отдельности (см. AGENTS.md, раздел про Zustand). */
export function selectCartItemCount(state: CartStore): number {
  return state.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function selectCartTotalCents(state: CartStore): number {
  return state.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
}
