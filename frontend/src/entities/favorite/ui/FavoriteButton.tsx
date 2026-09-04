'use client';

import { cn } from '@/shared/lib/cn';
import { HeartIcon } from '@/shared/ui/icons';
import { selectIsFavorite, useFavoriteStore } from '../model/favorite-store';
import type { FavoriteItem } from '../model/types';
import styles from './FavoriteButton.module.scss';

export interface FavoriteButtonProps {
  item: FavoriteItem;
  /** См. `BlockRendererProps.isEditing` у карточек товара/услуги — внутри
   * билдера кнопка не должна реально писать в `localStorage`, тот же
   * принцип, что у кнопки «В корзину»/«Записаться» на тех же карточках. */
  isEditing?: boolean;
  className?: string;
}

/**
 * Кнопка-сердечко на карточке товара/услуги (`ProductCard`/`ServiceCard`) —
 * переиспользуемая для обеих капабилити, т.к. `FavoriteItem` уже не знает
 * деталей ни одной из них (см. её комментарий). Сам факт «сохранено» читает
 * через параметризованный селектор `selectIsFavorite`, не весь `items` —
 * тот же приём точечной подписки, что у `dropPosition` в билдере
 * (`CanvasBlock.tsx`), чтобы toggle одного товара не перерендеривал все
 * карточки сетки разом.
 */
export function FavoriteButton({ item, isEditing, className }: FavoriteButtonProps) {
  const isFavorite = useFavoriteStore(selectIsFavorite(item.id));
  const toggle = useFavoriteStore((state) => state.toggle);

  return (
    <button
      type="button"
      className={cn(styles.button, isFavorite && styles['button--active'], className)}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
      onClick={(event) => {
        event.stopPropagation();
        if (isEditing) return;
        toggle(item);
      }}
    >
      <HeartIcon />
    </button>
  );
}
