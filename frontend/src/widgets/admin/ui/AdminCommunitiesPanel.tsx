'use client';

import { useCallback, useEffect, useState } from 'react';
import { deleteAdminCommunity, getAdminCommunities, type AdminCommunity } from '@/entities/admin';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';
import { useInfiniteScroll } from '@/shared/lib/use-infinite-scroll';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { IdBadge } from '@/shared/ui/IdBadge';
import { Loader } from '@/shared/ui/Loader';
import { Modal } from '@/shared/ui/Modal';
import styles from './AdminTable.module.scss';

const SEARCH_DEBOUNCE_MS = 300;
const ABOUT_PREVIEW_LENGTH = 140;

/**
 * У сообществ, в отличие от групп, нет владельца и формы создания для
 * обычных пользователей (см. `CommunitiesController` — только `list`/
 * `join`/`leave`) — они заводятся напрямую в БД (см. `prisma/seed.ts`).
 * Поэтому это первая возможность их модерировать вообще, не только удалить.
 */
export function AdminCommunitiesPanel() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [communities, setCommunities] = useState<AdminCommunity[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadMoreStatus, setLoadMoreStatus] = useState<AsyncStatus>('idle');
  const [reloadToken, setReloadToken] = useState(0);

  const [deleteTarget, setDeleteTarget] = useState<AdminCommunity | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getAdminCommunities({ search: debouncedSearch || undefined })
      .then(({ items, nextCursor: cursor }) => {
        if (cancelled) return;
        setCommunities(items);
        setNextCursor(cursor);
        setStatus('success');
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(
          loadError instanceof Error ? loadError.message : 'Не удалось загрузить сообщества',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, reloadToken]);

  const onSearchChange = (value: string) => {
    setSearch(value);
    setStatus('loading');
    setError(null);
  };

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadMoreStatus === 'loading') return;
    setLoadMoreStatus('loading');
    try {
      const { items, nextCursor: cursor } = await getAdminCommunities({
        cursor: nextCursor,
        search: debouncedSearch || undefined,
      });
      setCommunities((prev) => [...prev, ...items]);
      setNextCursor(cursor);
      setLoadMoreStatus('idle');
    } catch {
      setLoadMoreStatus('error');
    }
  }, [nextCursor, loadMoreStatus, debouncedSearch]);

  const sentinelRef = useInfiniteScroll(nextCursor, () => void loadMore());

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setPendingId(deleteTarget.id);
    setActionError(null);
    try {
      await deleteAdminCommunity(deleteTarget.id);
      setCommunities((prev) => prev.filter((community) => community.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить');
    } finally {
      setPendingId(null);
    }
  };

  const isFiltered = Boolean(debouncedSearch);

  return (
    <div className={styles['admin-table']}>
      <input
        className={styles['admin-table__search']}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Поиск по названию или id…"
        aria-label="Поиск сообществ"
      />

      {actionError && <p className={styles['admin-table__error']}>{actionError}</p>}

      {status === 'loading' && <Loader label="Загружаем сообщества…" />}
      {status === 'error' && (
        <ErrorState
          message={error}
          onRetry={() => {
            setStatus('loading');
            setReloadToken((token) => token + 1);
          }}
        />
      )}
      {status === 'success' && communities.length === 0 && (
        <EmptyState
          title={isFiltered ? 'Ничего не нашли' : 'Сообществ пока нет'}
          description={isFiltered ? 'Попробуйте другой запрос.' : undefined}
        />
      )}

      {status === 'success' && communities.length > 0 && (
        <div className={styles['admin-table__list']}>
          {communities.map((community) => (
            <div key={community.id} className={styles['admin-table__record']}>
              <IdBadge id={community.id} label="Сообщество" className={styles['admin-table__id']} />
              <div className={styles['admin-table__record-row']}>
                <Avatar initials={community.initials} size="md" />
                <div className={styles['admin-table__cell']}>
                  <span className={styles['admin-table__primary']}>
                    <span className={styles['admin-table__name']}>{community.name}</span>
                  </span>
                  <span className={styles['admin-table__secondary']}>
                    {community.about.slice(0, ABOUT_PREVIEW_LENGTH) || '(без описания)'}
                  </span>
                  <span className={styles['admin-table__meta']}>
                    {community.membersCount} участников · {community.postsCount} записей
                  </span>
                </div>
                <div className={styles['admin-table__actions']}>
                  <Button
                    variant="ghost"
                    className={styles['admin-table__danger-button']}
                    onClick={() => setDeleteTarget(community)}
                    disabled={pendingId === community.id}
                  >
                    Удалить
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <div ref={sentinelRef} aria-hidden="true" />
          {loadMoreStatus === 'loading' && <Loader label="Догружаем…" />}
        </div>
      )}

      {deleteTarget && (
        <Modal
          onClose={() => setDeleteTarget(null)}
          label={`Удалить сообщество ${deleteTarget.name}`}
        >
          <div className={styles['admin-table__modal']}>
            <h2>Удалить сообщество «{deleteTarget.name}»?</h2>
            <p className={styles['admin-table__modal-hint']}>
              Необратимо: подписки на сообщество удалятся вместе с ним. Записи, опубликованные в
              нём, останутся — но перестанут быть привязаны к сообществу.
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
