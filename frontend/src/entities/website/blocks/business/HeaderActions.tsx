'use client';

import { selectCartItemCount, useCartStore } from '@/entities/cart';
import { FavoritesPanel, selectFavoriteCount, useFavoriteStore } from '@/entities/favorite';
import { Popover } from '@/shared/ui/Popover';
import { HeartIcon, SearchIcon, ShoppingBagIcon } from '@/shared/ui/icons';
import styles from './HeaderActions.module.scss';

export interface HeaderActionsProps {
  businessId: string;
  showSearch: boolean;
  showFavorites: boolean;
  showCart: boolean;
  /** См. `BlockRendererProps.isEditing` — внутри билдера кнопка «Корзина» не
   * должна реально открывать чекаут-модалку (та же причина, что у кнопки «В
   * корзину» на `ProductCard`), а попапы поиска/избранного — не более чем
   * превью верстки без сайд-эффектов, поэтому им guard не нужен. */
  isEditing?: boolean;
}

/**
 * Кнопки-действия справа от навигации `businessheader` (`index.tsx`) — поиск/
 * избранное/корзина, у каждой свой попап (`shared/ui/Popover`), кроме
 * корзины: та открывает уже существующую полноэкранную модалку `CartWidget`
 * (Stripe/чекаут не помещаются в маленькую панель попапа и не нуждаются в
 * повторной реализации — обе кнопки, эта и плавающий `.fab` `CartWidget`,
 * дёргают один и тот же `useCartStore.open()`, см. её комментарий).
 */
export function HeaderActions({
  businessId,
  showSearch,
  showFavorites,
  showCart,
  isEditing,
}: HeaderActionsProps) {
  const cartCount = useCartStore(selectCartItemCount);
  const openCart = useCartStore((state) => state.open);
  const favoriteCount = useFavoriteStore(selectFavoriteCount);

  if (!showSearch && !showFavorites && !showCart) return null;

  return (
    <div className={styles.actions}>
      {showSearch && (
        <Popover
          panelLabel="Поиск по сайту"
          trigger={({ toggle }) => (
            <button type="button" className={styles.button} aria-label="Поиск" onClick={toggle}>
              <SearchIcon />
            </button>
          )}
        >
          {() => (
            <div className={styles.searchStub}>
              <SearchIcon />
              <p>Поиск по товарам, услугам и статьям сайта — совсем скоро.</p>
            </div>
          )}
        </Popover>
      )}

      {showFavorites && (
        <Popover
          panelLabel="Избранное"
          align="end"
          trigger={({ toggle }) => (
            <button type="button" className={styles.button} aria-label="Избранное" onClick={toggle}>
              <HeartIcon />
              {favoriteCount > 0 && <span className={styles.badge}>{favoriteCount}</span>}
            </button>
          )}
        >
          {() => <FavoritesPanel businessId={businessId} />}
        </Popover>
      )}

      {showCart && (
        <button
          type="button"
          className={styles.button}
          aria-label="Корзина"
          onClick={() => {
            if (!isEditing) openCart();
          }}
        >
          <ShoppingBagIcon />
          {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
        </button>
      )}
    </div>
  );
}
