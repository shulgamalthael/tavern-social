'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  banUser,
  deleteAdminUser,
  getAdminUsers,
  setUserRole,
  unbanUser,
  type AdminUser,
  type AdminUserRoleFilter,
  type AdminUserStatusFilter,
} from '@/entities/admin';
import { useCurrentUser } from '@/entities/user';
import { cn } from '@/shared/lib/cn';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';
import { useInfiniteScroll } from '@/shared/lib/use-infinite-scroll';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { Modal } from '@/shared/ui/Modal';
import styles from './AdminTable.module.scss';

const SEARCH_DEBOUNCE_MS = 300;

const ROLE_FILTERS: { id: AdminUserRoleFilter; label: string }[] = [
  { id: 'all', label: 'Все роли' },
  { id: 'user', label: 'Пользователи' },
  { id: 'admin', label: 'Админы' },
];

const STATUS_FILTERS: { id: AdminUserStatusFilter; label: string }[] = [
  { id: 'all', label: 'Все статусы' },
  { id: 'active', label: 'Активные' },
  { id: 'banned', label: 'В бане' },
];

/**
 * Тот же курсорный приём без стора, что и `CommunitiesWidget` (см. AGENTS.md
 * §4 — данные нужны только этой панели) — плюс поиск с debounce (тем же
 * хуком, что и `useGlobalSearch`), фильтры по роли/статусу и точечные правки
 * списка после бана/разбана (заменяем строку целиком новым объектом от
 * backend, а не патчим поле руками).
 */
export function AdminUsersPanel() {
  const { currentUser } = useCurrentUser();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [role, setRole] = useState<AdminUserRoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<AdminUserStatusFilter>('all');
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadMoreStatus, setLoadMoreStatus] = useState<AsyncStatus>('idle');
  const [reloadToken, setReloadToken] = useState(0);

  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // `status` переходит в 'loading' не здесь (react-hooks/set-state-in-effect
  // не разрешает синхронный setState в теле эффекта), а в обработчиках,
  // которые меняют `debouncedSearch`/фильтры/`reloadToken` — см.
  // `onSearchChange`/`onFilterChange` ниже и `onRetry` у `ErrorState` (тот же
  // приём, что в `CommunitiesWidget`).
  useEffect(() => {
    let cancelled = false;

    getAdminUsers({ search: debouncedSearch || undefined, role, status: statusFilter })
      .then(({ items, nextCursor: cursor }) => {
        if (cancelled) return;
        setUsers(items);
        setNextCursor(cursor);
        setStatus('success');
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(
          loadError instanceof Error ? loadError.message : 'Не удалось загрузить пользователей',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, role, statusFilter, reloadToken]);

  const onSearchChange = (value: string) => {
    setSearch(value);
    setStatus('loading');
    setError(null);
  };

  const onRoleChange = (value: AdminUserRoleFilter) => {
    setRole(value);
    setStatus('loading');
    setError(null);
  };

  const onStatusFilterChange = (value: AdminUserStatusFilter) => {
    setStatusFilter(value);
    setStatus('loading');
    setError(null);
  };

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadMoreStatus === 'loading') return;
    setLoadMoreStatus('loading');
    try {
      const { items, nextCursor: cursor } = await getAdminUsers({
        cursor: nextCursor,
        search: debouncedSearch || undefined,
        role,
        status: statusFilter,
      });
      setUsers((prev) => [...prev, ...items]);
      setNextCursor(cursor);
      setLoadMoreStatus('idle');
    } catch {
      setLoadMoreStatus('error');
    }
  }, [nextCursor, loadMoreStatus, debouncedSearch, role, statusFilter]);

  const sentinelRef = useInfiniteScroll(nextCursor, () => void loadMore());

  const replaceUser = (updated: AdminUser) => {
    setUsers((prev) => prev.map((user) => (user.id === updated.id ? updated : user)));
  };

  const confirmBan = async () => {
    if (!banTarget) return;
    setPendingId(banTarget.id);
    setActionError(null);
    try {
      replaceUser(await banUser(banTarget.id, banReason.trim() || undefined));
      setBanTarget(null);
      setBanReason('');
    } catch (banError) {
      setActionError(banError instanceof Error ? banError.message : 'Не удалось забанить');
    } finally {
      setPendingId(null);
    }
  };

  const unban = async (user: AdminUser) => {
    setPendingId(user.id);
    setActionError(null);
    try {
      replaceUser(await unbanUser(user.id));
    } catch (unbanError) {
      setActionError(unbanError instanceof Error ? unbanError.message : 'Не удалось разбанить');
    } finally {
      setPendingId(null);
    }
  };

  const toggleRole = async (user: AdminUser) => {
    setPendingId(user.id);
    setActionError(null);
    try {
      replaceUser(await setUserRole(user.id, user.role === 'admin' ? 'user' : 'admin'));
    } catch (roleError) {
      setActionError(roleError instanceof Error ? roleError.message : 'Не удалось изменить роль');
    } finally {
      setPendingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setPendingId(deleteTarget.id);
    setActionError(null);
    try {
      await deleteAdminUser(deleteTarget.id);
      setUsers((prev) => prev.filter((user) => user.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить');
    } finally {
      setPendingId(null);
    }
  };

  const isFiltered = Boolean(debouncedSearch) || role !== 'all' || statusFilter !== 'all';

  return (
    <div className={styles['admin-table']}>
      <input
        className={styles['admin-table__search']}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Поиск по имени, email или id…"
        aria-label="Поиск пользователей"
      />

      <div className={styles['admin-table__filters']}>
        <div className={styles['admin-table__filter-group']} role="group" aria-label="Роль">
          {ROLE_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                styles['admin-table__filter-chip'],
                role === item.id && styles['admin-table__filter-chip--active'],
              )}
              onClick={() => onRoleChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={styles['admin-table__filter-group']} role="group" aria-label="Статус">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                styles['admin-table__filter-chip'],
                statusFilter === item.id && styles['admin-table__filter-chip--active'],
              )}
              onClick={() => onStatusFilterChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {actionError && <p className={styles['admin-table__error']}>{actionError}</p>}

      {status === 'loading' && <Loader label="Загружаем пользователей…" />}
      {status === 'error' && (
        <ErrorState
          message={error}
          onRetry={() => {
            setStatus('loading');
            setReloadToken((token) => token + 1);
          }}
        />
      )}
      {status === 'success' && users.length === 0 && (
        <EmptyState
          title={isFiltered ? 'Никого не нашли' : 'Пользователей пока нет'}
          description={isFiltered ? 'Попробуйте другой запрос или фильтр.' : undefined}
        />
      )}

      {status === 'success' && users.length > 0 && (
        <div className={styles['admin-table__list']}>
          {users.map((user) => {
            const isSelf = user.id === currentUser.id;
            return (
              <div key={user.id} className={styles['admin-table__record']}>
                <code className={styles['admin-table__id']}>{user.id}</code>
                <div className={styles['admin-table__record-row']}>
                  <Avatar initials={user.initials} src={user.avatarUrl} size="md" />
                  <div className={styles['admin-table__cell']}>
                    <span className={styles['admin-table__primary']}>
                      <span className={styles['admin-table__name']}>{user.name}</span>
                      {user.role === 'admin' && (
                        <span className={styles['admin-table__role-badge']}>админ</span>
                      )}
                      {user.isBanned && (
                        <span className={styles['admin-table__ban-badge']}>бан</span>
                      )}
                      {isSelf && <span className={styles['admin-table__content-badge']}>вы</span>}
                    </span>
                    <span className={styles['admin-table__secondary']}>
                      {user.email} · {user.postsCount} записей
                      {user.isBanned && user.bannedReason ? ` · причина: ${user.bannedReason}` : ''}
                    </span>
                  </div>
                  <div className={styles['admin-table__actions']}>
                    {!isSelf && (
                      <Button
                        variant="outline"
                        onClick={() => void toggleRole(user)}
                        disabled={pendingId === user.id}
                      >
                        {user.role === 'admin' ? 'Снять админа' : 'Сделать админом'}
                      </Button>
                    )}
                    {user.role !== 'admin' &&
                      (user.isBanned ? (
                        <Button
                          variant="outline"
                          onClick={() => void unban(user)}
                          disabled={pendingId === user.id}
                        >
                          Разбанить
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => setBanTarget(user)}
                          disabled={pendingId === user.id}
                        >
                          Забанить
                        </Button>
                      ))}
                    {user.role !== 'admin' && (
                      <Button
                        variant="ghost"
                        className={styles['admin-table__danger-button']}
                        onClick={() => setDeleteTarget(user)}
                        disabled={pendingId === user.id}
                      >
                        Удалить
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={sentinelRef} aria-hidden="true" />
          {loadMoreStatus === 'loading' && <Loader label="Догружаем…" />}
        </div>
      )}

      {banTarget && (
        <Modal onClose={() => setBanTarget(null)} label={`Забанить ${banTarget.name}`}>
          <div className={styles['admin-table__modal']}>
            <h2>Забанить {banTarget.name}?</h2>
            <p className={styles['admin-table__modal-hint']}>
              Пользователь не сможет заходить в приложение, пока вы его не разбаните. Данные (посты,
              комментарии) остаются нетронутыми.
            </p>
            <textarea
              className={styles['admin-table__reason']}
              value={banReason}
              onChange={(event) => setBanReason(event.target.value)}
              placeholder="Причина (необязательно) — видна только администраторам"
              rows={3}
            />
            <div className={styles['admin-table__modal-actions']}>
              <Button variant="outline" onClick={() => setBanTarget(null)}>
                Отмена
              </Button>
              <Button onClick={() => void confirmBan()} disabled={pendingId === banTarget.id}>
                Забанить
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} label={`Удалить ${deleteTarget.name}`}>
          <div className={styles['admin-table__modal']}>
            <h2>Удалить аккаунт {deleteTarget.name}?</h2>
            <p className={styles['admin-table__modal-hint']}>
              Необратимо: вместе с аккаунтом удалятся все его посты, комментарии, дружбы и
              сообщения. Если нужно только ограничить доступ — используйте бан.
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
                Удалить навсегда
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
