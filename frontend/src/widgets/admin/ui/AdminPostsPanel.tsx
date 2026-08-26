'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  deleteAdminPost,
  getAdminPosts,
  type AdminPost,
  type AdminPostLocationFilter,
  type AdminPostTypeFilter,
} from '@/entities/admin';
import { cn } from '@/shared/lib/cn';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';
import { findClickedImageIndex } from '@/shared/lib/find-clicked-image-index';
import { useInfiniteScroll } from '@/shared/lib/use-infinite-scroll';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { CloseIcon } from '@/shared/ui/icons';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { IdBadge, IdBadgeGroup } from '@/shared/ui/IdBadge';
import { ImageLightbox } from '@/shared/ui/ImageLightbox';
import { Loader } from '@/shared/ui/Loader';
import { Modal } from '@/shared/ui/Modal';
import styles from './AdminTable.module.scss';

const SEARCH_DEBOUNCE_MS = 300;

const TYPE_FILTERS: { id: AdminPostTypeFilter; label: string }[] = [
  { id: 'all', label: 'Все типы' },
  { id: 'original', label: 'Обычные' },
  { id: 'repost', label: 'Репосты' },
];

const LOCATION_FILTERS: { id: AdminPostLocationFilter; label: string }[] = [
  { id: 'all', label: 'Везде' },
  { id: 'wall', label: 'На стене' },
  { id: 'group', label: 'В группе' },
];

interface LightboxTarget {
  images: string[];
  index: number;
}

export function AdminPostsPanel() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [type, setType] = useState<AdminPostTypeFilter>('all');
  const [location, setLocation] = useState<AdminPostLocationFilter>('all');
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadMoreStatus, setLoadMoreStatus] = useState<AsyncStatus>('idle');
  const [reloadToken, setReloadToken] = useState(0);

  const [deleteTarget, setDeleteTarget] = useState<AdminPost | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<LightboxTarget | null>(null);

  // `status` переходит в 'loading' не здесь (react-hooks/set-state-in-effect
  // не разрешает синхронный setState в теле эффекта), а в обработчиках,
  // которые меняют `debouncedSearch`/фильтры/`reloadToken` — см.
  // `onSearchChange`/`onFilterChange` ниже и `onRetry` у `ErrorState` (тот же
  // приём, что в `CommunitiesWidget`).
  useEffect(() => {
    let cancelled = false;

    getAdminPosts({ search: debouncedSearch || undefined, type, location })
      .then(({ items, nextCursor: cursor }) => {
        if (cancelled) return;
        setPosts(items);
        setNextCursor(cursor);
        setStatus('success');
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить записи');
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, type, location, reloadToken]);

  const onSearchChange = (value: string) => {
    setSearch(value);
    setStatus('loading');
    setError(null);
  };

  const onTypeChange = (value: AdminPostTypeFilter) => {
    setType(value);
    setStatus('loading');
    setError(null);
  };

  const onLocationChange = (value: AdminPostLocationFilter) => {
    setLocation(value);
    setStatus('loading');
    setError(null);
  };

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadMoreStatus === 'loading') return;
    setLoadMoreStatus('loading');
    try {
      const { items, nextCursor: cursor } = await getAdminPosts({
        cursor: nextCursor,
        search: debouncedSearch || undefined,
        type,
        location,
      });
      setPosts((prev) => [...prev, ...items]);
      setNextCursor(cursor);
      setLoadMoreStatus('idle');
    } catch {
      setLoadMoreStatus('error');
    }
  }, [nextCursor, loadMoreStatus, debouncedSearch, type, location]);

  const sentinelRef = useInfiniteScroll(nextCursor, () => void loadMore());

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setPendingId(deleteTarget.id);
    setActionError(null);
    try {
      await deleteAdminPost(deleteTarget.id);
      setPosts((prev) => prev.filter((post) => post.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить');
    } finally {
      setPendingId(null);
    }
  };

  const isFiltered = Boolean(debouncedSearch) || type !== 'all' || location !== 'all';

  return (
    <div className={styles['admin-table']}>
      <input
        className={styles['admin-table__search']}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Поиск по тексту записи или id…"
        aria-label="Поиск записей"
      />

      <div className={styles['admin-table__filters']}>
        <div className={styles['admin-table__filter-group']} role="group" aria-label="Тип записи">
          {TYPE_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                styles['admin-table__filter-chip'],
                type === item.id && styles['admin-table__filter-chip--active'],
              )}
              onClick={() => onTypeChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={styles['admin-table__filter-group']} role="group" aria-label="Раздел">
          {LOCATION_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                styles['admin-table__filter-chip'],
                location === item.id && styles['admin-table__filter-chip--active'],
              )}
              onClick={() => onLocationChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {actionError && <p className={styles['admin-table__error']}>{actionError}</p>}

      {status === 'loading' && <Loader label="Загружаем записи…" />}
      {status === 'error' && (
        <ErrorState
          message={error}
          onRetry={() => {
            setStatus('loading');
            setReloadToken((token) => token + 1);
          }}
        />
      )}
      {status === 'success' && posts.length === 0 && (
        <EmptyState
          title={isFiltered ? 'Ничего не нашли' : 'Записей пока нет'}
          description={isFiltered ? 'Попробуйте другой запрос или фильтр.' : undefined}
        />
      )}

      {status === 'success' && posts.length > 0 && (
        <div className={styles['admin-table__list']}>
          {posts.map((post) => (
            <div key={post.id} className={styles['admin-table__record']}>
              {/* Аватар/имя/id и кнопка удаления — общая шапка записи,
               * прижатая к верху (`align-items: flex-start`, см. CSS), а не
               * старая раскладка `.admin-table__record-row` (центрирует по
               * вертикали — годится для короткой строки пользователя/группы,
               * но с полным рендером записи ниже, который может быть выше
               * экрана, утягивала аватар и кнопку в визуальный центр записи,
               * а не к шапке, где они принадлежат). Тот же приём, что у
               * `PostCard.tsx`: `.post__head` — аватар, имя и мета слева,
               * компактная иконка-кнопка действия справа. */}
              <div className={styles['admin-table__post-head']}>
                <Avatar initials={post.authorInitials} src={post.authorAvatarUrl} size="md" />
                <div className={styles['admin-table__post-head-body']}>
                  <span className={styles['admin-table__primary']}>
                    <span className={styles['admin-table__name']}>{post.authorName}</span>
                    {post.isRepost && (
                      <span className={styles['admin-table__role-badge']}>репост</span>
                    )}
                    {post.groupName && (
                      <span className={styles['admin-table__role-badge']}>{post.groupName}</span>
                    )}
                  </span>
                  <IdBadgeGroup>
                    <IdBadge id={post.id} label="Запись" />
                    <IdBadge id={post.authorId} label="Автор" />
                  </IdBadgeGroup>
                </div>
                <button
                  type="button"
                  className={styles['admin-table__post-delete']}
                  aria-label={`Удалить запись ${post.authorName}`}
                  title="Удалить запись"
                  onClick={() => setDeleteTarget(post)}
                  disabled={pendingId === post.id}
                >
                  <CloseIcon />
                </button>
              </div>

              {/* Полный рендер, тот же, что и на основном сайте (см.
               * `PostCard.tsx`, `@include rich-content` в
               * `AdminTable.module.scss`) — раньше здесь была обрезанная
               * строка текста без разметки и отдельная строка мелких
               * обрезанных превью картинок; для модерации нужно видеть
               * запись как есть, форматирование и фото в полный размер
               * включительно, а не гадать по значкам «Таблица»/«Фото×N». */}
              {post.text ? (
                <div
                  className={styles['admin-table__post-content']}
                  onClick={(event) => {
                    const index = findClickedImageIndex(event, post.images);
                    if (index >= 0) setLightbox({ images: post.images, index });
                  }}
                  dangerouslySetInnerHTML={{ __html: post.text }}
                />
              ) : (
                <span className={styles['admin-table__secondary']}>(без текста)</span>
              )}
              <span className={styles['admin-table__meta']}>
                {post.likesCount} кружек · {post.commentsCount} ответов
              </span>
            </div>
          ))}
          <div ref={sentinelRef} aria-hidden="true" />
          {loadMoreStatus === 'loading' && <Loader label="Догружаем…" />}
        </div>
      )}

      {lightbox && (
        <ImageLightbox
          images={lightbox.images.map((url, index) => ({ id: `${url}-${index}`, url }))}
          index={lightbox.index}
          onIndexChange={(index) => setLightbox((state) => (state ? { ...state, index } : state))}
          onClose={() => setLightbox(null)}
        />
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} label="Удалить запись">
          <div className={styles['admin-table__modal']}>
            <h2>Удалить эту запись?</h2>
            <p className={styles['admin-table__modal-hint']}>
              Необратимо: запись, её картинки и комментарии к ней удалятся.
            </p>
            <div className={styles['admin-table__modal-actions']}>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Отмена
              </Button>
              <Button
                className={styles['admin-table__danger-button']}
                onClick={() => void confirmDelete()}
                disabled={pendingId === deleteTarget.id}
              >
                Удалить
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
