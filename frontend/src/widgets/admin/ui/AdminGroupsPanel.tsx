'use client';

import { useCallback, useEffect, useState } from 'react';
import { deleteAdminGroup, getAdminGroups, type AdminGroup } from '@/entities/admin';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { pluralizeRu } from '@/shared/lib/pluralize-ru';
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
const DESCRIPTION_PREVIEW_LENGTH = 140;

const GROUP_TYPE_LABEL: Record<AdminGroup['type'], string> = {
  open: 'открытая',
  private: 'закрытая',
};

/**
 * Групп раньше нельзя было удалить вообще — ни владельцу, ни тем более
 * администрации (см. `GroupsController` — там есть `create`/`update`, но
 * нет `remove`). Посты группы при удалении не пропадают: `Post.groupId`
 * — `onDelete: SetNull` (см. схему), намеренный выбор — не стирать чужой
 * авторский контент молча.
 */
export function AdminGroupsPanel() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadMoreStatus, setLoadMoreStatus] = useState<AsyncStatus>('idle');
  const [reloadToken, setReloadToken] = useState(0);

  const [deleteTarget, setDeleteTarget] = useState<AdminGroup | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getAdminGroups({ search: debouncedSearch || undefined })
      .then(({ items, nextCursor: cursor }) => {
        if (cancelled) return;
        setGroups(items);
        setNextCursor(cursor);
        setStatus('success');
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить группы');
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
      const { items, nextCursor: cursor } = await getAdminGroups({
        cursor: nextCursor,
        search: debouncedSearch || undefined,
      });
      setGroups((prev) => [...prev, ...items]);
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
      await deleteAdminGroup(deleteTarget.id);
      setGroups((prev) => prev.filter((group) => group.id !== deleteTarget.id));
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
        aria-label="Поиск групп"
      />

      {actionError && <p className={styles['admin-table__error']}>{actionError}</p>}

      {status === 'loading' && <Loader label="Загружаем группы…" />}
      {status === 'error' && (
        <ErrorState
          message={error}
          onRetry={() => {
            setStatus('loading');
            setReloadToken((token) => token + 1);
          }}
        />
      )}
      {status === 'success' && groups.length === 0 && (
        <EmptyState
          title={isFiltered ? 'Ничего не нашли' : 'Групп пока нет'}
          description={isFiltered ? 'Попробуйте другой запрос.' : undefined}
        />
      )}

      {status === 'success' && groups.length > 0 && (
        <div className={styles['admin-table__list']}>
          {groups.map((group) => (
            <div key={group.id} className={styles['admin-table__record']}>
              <IdBadge id={group.id} label="Группа" className={styles['admin-table__id']} />
              <div className={styles['admin-table__record-row']}>
                <Avatar initials={group.initials} src={group.avatarUrl} size="md" />
                <div className={styles['admin-table__cell']}>
                  <span className={styles['admin-table__primary']}>
                    <span className={styles['admin-table__name']}>{group.name}</span>
                    <span className={styles['admin-table__role-badge']}>
                      {GROUP_TYPE_LABEL[group.type]}
                    </span>
                  </span>
                  <span className={styles['admin-table__secondary']}>
                    {group.description.slice(0, DESCRIPTION_PREVIEW_LENGTH) || '(без описания)'}
                  </span>
                  <span className={styles['admin-table__meta']}>
                    {group.membersCount}{' '}
                    {pluralizeRu(group.membersCount, ['участник', 'участника', 'участников'])} ·{' '}
                    {group.postsCount}{' '}
                    {pluralizeRu(group.postsCount, ['запись', 'записи', 'записей'])}
                  </span>
                </div>
                <div className={styles['admin-table__actions']}>
                  <Button
                    variant="ghost"
                    className={styles['admin-table__danger-button']}
                    onClick={() => setDeleteTarget(group)}
                    disabled={pendingId === group.id}
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
        <Modal onClose={() => setDeleteTarget(null)} label={`Удалить группу ${deleteTarget.name}`}>
          <div className={styles['admin-table__modal']}>
            <h2>Удалить группу «{deleteTarget.name}»?</h2>
            <p className={styles['admin-table__modal-hint']}>
              Необратимо: участники и заявки на вступление удалятся вместе с группой. Записи,
              опубликованные в ней, останутся — но перестанут быть привязаны к группе.
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
