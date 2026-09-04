'use client';

import { useEffect } from 'react';
import { formatMoney } from '@/shared/lib/format-money';
import { HeartIcon, TrashIcon } from '@/shared/ui/icons';
import { useFavoriteStore } from '../model/favorite-store';
import styles from './FavoritesPanel.module.scss';

export interface FavoritesPanelProps {
  businessId: string;
}

/**
 * Содержимое попапа кнопки «Избранное» в шапке сайта (`HeaderActions.tsx`,
 * рендерится внутри `Popover`) — тот же визуальный язык, что и мини-список
 * `CartWidget`'s шага `'cart'`, только без чекаута (избранное — просто
 * список, оформление заказа/запись всё равно происходит с карточки товара/
 * услуги, не отсюда).
 */
export function FavoritesPanel({ businessId }: FavoritesPanelProps) {
  const ensureBusiness = useFavoriteStore((state) => state.ensureBusiness);
  const items = useFavoriteStore((state) => state.items);
  const remove = useFavoriteStore((state) => state.remove);

  useEffect(() => {
    ensureBusiness(businessId);
  }, [businessId, ensureBusiness]);

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <HeartIcon />
        <p>Пока пусто — нажмите на сердечко у товара или услуги, чтобы сохранить.</p>
      </div>
    );
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id} className={styles.row}>
          <div className={styles['row__image']}>
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- превью сохранённого товара/услуги
              <img src={item.image} alt="" />
            ) : (
              <HeartIcon />
            )}
          </div>
          <div className={styles['row__body']}>
            <span className={styles['row__title']}>{item.name}</span>
            <span className={styles['row__price']}>
              {formatMoney(item.priceCents, item.currency)}
            </span>
          </div>
          <button
            type="button"
            className={styles.remove}
            aria-label={`Убрать «${item.name}» из избранного`}
            onClick={() => remove(item.id)}
          >
            <TrashIcon />
          </button>
        </li>
      ))}
    </ul>
  );
}
