'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Friend } from '@/entities/friend';
import { Avatar } from '@/shared/ui/Avatar';
import { CloseIcon, SearchIcon } from '@/shared/ui/icons';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import styles from './FriendsListModal.module.scss';

export interface FriendsListModalProps {
  friends: Friend[];
  onClose: () => void;
  onSelectFriend: (friendId: string) => void;
  /** Разрыв дружбы прямо из списка — показывается только на своей странице
   * (см. `ProfileFriendsCard`, `handleRemove`). */
  onRemoveFriend?: (friendId: string) => Promise<void> | void;
}

/**
 * Полный список друзей с поиском — открывается по «+N» в `ProfileFriendsCard`
 * (тот же приём, что и `ImageLightbox`: портал в `document.body`, чтобы не
 * попасть под плавающий док навигации, см. комментарий там же). Список уже
 * загружен целиком в `ProfileFriendsCard` — поиск здесь чисто клиентский
 * фильтр по имени, без отдельного запроса и без debounce (не нужен для
 * фильтрации уже готового массива в памяти).
 */
export function FriendsListModal({
  friends,
  onClose,
  onSelectFriend,
  onRemoveFriend,
}: FriendsListModalProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return friends;
    return friends.filter((friend) => friend.name.toLowerCase().includes(trimmed));
  }, [friends, query]);

  return createPortal(
    <div
      className={styles.modal}
      role="dialog"
      aria-modal="true"
      aria-label="Список друзей"
      onClick={onClose}
    >
      <div className={styles['modal__card']} onClick={(event) => event.stopPropagation()}>
        <div className={styles['modal__header']}>
          <h2 className={styles['modal__title']}>Друзья · {friends.length}</h2>
          <button
            type="button"
            className={styles['modal__close']}
            onClick={onClose}
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>
        </div>

        <label className={styles['modal__search']}>
          <SearchIcon className={styles['modal__search-icon']} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти среди друзей"
            autoFocus
          />
        </label>

        <ScrollArea
          className={styles['modal__list']}
          viewportClassName={styles['modal__list-viewport']}
        >
          {filtered.length === 0 ? (
            <p className={styles['modal__empty']}>Никого не нашли</p>
          ) : (
            filtered.map((friend) => (
              <div key={friend.id} className={styles['modal__row-wrap']}>
                <button
                  type="button"
                  className={styles['modal__row']}
                  onClick={() => onSelectFriend(friend.id)}
                >
                  <Avatar initials={friend.initials} src={friend.avatarUrl} size="sm" />
                  <span className={styles['modal__row-body']}>
                    <span className={styles['modal__row-title']}>{friend.name}</span>
                    <span className={styles['modal__row-subtitle']}>
                      {friend.note || friend.city || 'пока без подписи'}
                    </span>
                  </span>
                </button>
                {onRemoveFriend && (
                  <button
                    type="button"
                    className={styles['modal__row-delete']}
                    onClick={() => void onRemoveFriend(friend.id)}
                    aria-label={`Удалить ${friend.name} из друзей`}
                  >
                    ×
                  </button>
                )}
              </div>
            ))
          )}
        </ScrollArea>
      </div>
    </div>,
    document.body,
  );
}
