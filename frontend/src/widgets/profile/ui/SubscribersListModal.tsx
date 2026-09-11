'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getFollowers, getFollowing, type Follower } from '@/entities/follow';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { useInfiniteScroll } from '@/shared/lib/use-infinite-scroll';
import { Avatar } from '@/shared/ui/Avatar';
import { CloseIcon } from '@/shared/ui/icons';
import { Loader } from '@/shared/ui/Loader';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import styles from './SubscribersListModal.module.scss';

export interface SubscribersListModalProps {
  userId: string;
  kind: 'followers' | 'following';
  onClose: () => void;
  onSelectSubscriber: (userId: string) => void;
  /** Отписаться прямо из списка — показывается только для СВОЕГО списка
   * подписок (`kind === 'following'` на своей странице, см.
   * `ProfileWidget`/`UserProfileView`). Для списка подписчиков действия нет
   * — «убрать подписчика» не входит в эту задачу. */
  onUnsubscribe?: (userId: string) => Promise<void> | void;
}

const TITLE: Record<SubscribersListModalProps['kind'], string> = {
  followers: 'Подписчики',
  following: 'Подписки',
};

const EMPTY_COPY: Record<SubscribersListModalProps['kind'], string> = {
  followers: 'Пока нет подписчиков',
  following: 'Пока ни на кого не подписан(а)',
};

/**
 * В отличие от `FriendsListModal` — без поиска: тот список грузится целиком
 * одним запросом (друзья ограничены порогом задачи), поиск там — честный
 * клиентский фильтр по уже полному набору. Подписчики ничем не ограничены
 * (§85) — список грузится постранично, и поиск по ещё частично
 * незагруженным данным молча не находил бы часть подписчиков, тот же
 * компромисс, что `FriendsListModal`'s комментарий уже называет для другого
 * случая. Вместо поиска — настоящая курсорная подгрузка по прокрутке
 * (`useInfiniteScroll`, тот же приём, что `GalleryGrid`/`FriendsWidget`).
 */
export function SubscribersListModal({
  userId,
  kind,
  onClose,
  onSelectSubscriber,
  onUnsubscribe,
}: SubscribersListModalProps) {
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [items, setItems] = useState<Follower[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadMoreStatus, setLoadMoreStatus] = useState<AsyncStatus>('idle');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchPage = kind === 'followers' ? getFollowers : getFollowing;

  useEffect(() => {
    let cancelled = false;

    fetchPage(userId)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setStatus('success');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchPage стабилен для данного kind
  }, [userId, kind]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function loadMore() {
    if (!nextCursor || loadMoreStatus === 'loading') return;
    setLoadMoreStatus('loading');
    fetchPage(userId, nextCursor)
      .then((page) => {
        setItems((prev) => [...prev, ...page.items]);
        setNextCursor(page.nextCursor);
        setLoadMoreStatus('success');
      })
      .catch(() => setLoadMoreStatus('error'));
  }

  const sentinelRef = useInfiniteScroll(nextCursor, loadMore);

  async function handleUnsubscribe(subscriberId: string) {
    if (!onUnsubscribe) return;
    setRemovingId(subscriberId);
    await onUnsubscribe(subscriberId);
    setItems((prev) => prev.filter((item) => item.id !== subscriberId));
    setRemovingId(null);
  }

  return createPortal(
    <div
      className={styles.modal}
      role="dialog"
      aria-modal="true"
      aria-label={TITLE[kind]}
      onClick={onClose}
    >
      <div className={styles['modal__card']} onClick={(event) => event.stopPropagation()}>
        <div className={styles['modal__header']}>
          <h2 className={styles['modal__title']}>
            {TITLE[kind]} {status === 'success' ? `· ${items.length}` : ''}
          </h2>
          <button
            type="button"
            className={styles['modal__close']}
            onClick={onClose}
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>
        </div>

        {status === 'loading' && <Loader label="Загружаем…" />}
        {status === 'error' && (
          <p className={styles['modal__empty']}>Не удалось загрузить список</p>
        )}

        {status === 'success' && (
          <ScrollArea
            className={styles['modal__list']}
            viewportClassName={styles['modal__list-viewport']}
          >
            {items.length === 0 ? (
              <p className={styles['modal__empty']}>{EMPTY_COPY[kind]}</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className={styles['modal__row-wrap']}>
                  <button
                    type="button"
                    className={styles['modal__row']}
                    onClick={() => onSelectSubscriber(item.id)}
                  >
                    <Avatar initials={item.initials} src={item.avatarUrl} size="sm" />
                    <span className={styles['modal__row-body']}>
                      <span className={styles['modal__row-title']}>{item.name}</span>
                      <span className={styles['modal__row-subtitle']}>
                        {item.tagline || item.city || 'пока без подписи'}
                      </span>
                    </span>
                  </button>
                  {onUnsubscribe && (
                    <button
                      type="button"
                      className={styles['modal__row-delete']}
                      disabled={removingId === item.id}
                      onClick={() => void handleUnsubscribe(item.id)}
                      aria-label={`Отписаться от ${item.name}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))
            )}
            {nextCursor && <div ref={sentinelRef} aria-hidden="true" />}
            {loadMoreStatus === 'loading' && <Loader label="Загружаем ещё…" />}
          </ScrollArea>
        )}
      </div>
    </div>,
    document.body,
  );
}
