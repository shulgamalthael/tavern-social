'use client';

import { useCallback, useState } from 'react';
import {
  getAdminCreators,
  reinstateAdminCreator,
  suspendAdminCreator,
  type AdminCreatorListItem,
} from '@/entities/admin';
import { CREATOR_STATUS_LABELS, type CreatorStatus } from '@/entities/creator';
import { cn } from '@/shared/lib/cn';
import { getInitials } from '@/shared/lib/get-initials';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { IdBadge } from '@/shared/ui/IdBadge';
import { Modal } from '@/shared/ui/Modal';
import styles from './AdminTable.module.scss';

const STATUS_FILTERS: { id: CreatorStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'verification_pending', label: CREATOR_STATUS_LABELS.verification_pending },
  { id: 'verified', label: CREATOR_STATUS_LABELS.verified },
  { id: 'active', label: CREATOR_STATUS_LABELS.active },
  { id: 'rejected', label: CREATOR_STATUS_LABELS.rejected },
  { id: 'suspended', label: CREATOR_STATUS_LABELS.suspended },
];

function statusBadgeClass(status: CreatorStatus): string {
  if (status === 'active' || status === 'verified') return styles['admin-table__role-badge'];
  if (status === 'rejected' || status === 'suspended') return styles['admin-table__ban-badge'];
  return styles['admin-table__content-badge'];
}

interface CreatorRowProps {
  creator: AdminCreatorListItem;
  onChanged: () => void;
}

function CreatorRow({ creator, onChanged }: CreatorRowProps) {
  const [suspending, setSuspending] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSuspend() {
    setBusy(true);
    setError(null);
    try {
      await suspendAdminCreator(creator.id, reason.trim() || undefined);
      setSuspending(false);
      setReason('');
      onChanged();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось приостановить');
    } finally {
      setBusy(false);
    }
  }

  async function handleReinstate() {
    setBusy(true);
    setError(null);
    try {
      await reinstateAdminCreator(creator.id);
      onChanged();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось восстановить');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles['admin-table__record']}>
      <IdBadge id={creator.id} label="Creator" className={styles['admin-table__id']} />
      <div className={styles['admin-table__record-row']}>
        <Avatar size="md" initials={getInitials(creator.user.name)} src={creator.user.avatarUrl} />
        <div className={styles['admin-table__cell']}>
          <span className={styles['admin-table__primary']}>
            <span className={styles['admin-table__name']}>{creator.user.name}</span>
            <span className={statusBadgeClass(creator.status)}>
              {CREATOR_STATUS_LABELS[creator.status]}
            </span>
          </span>
          {creator.primaryCategory && (
            <span className={styles['admin-table__secondary']}>{creator.primaryCategory}</span>
          )}
          {creator.status === 'rejected' && creator.rejectionReason && (
            <span className={styles['admin-table__secondary']}>{creator.rejectionReason}</span>
          )}
          {creator.status === 'suspended' && creator.suspendedReason && (
            <span className={styles['admin-table__secondary']}>{creator.suspendedReason}</span>
          )}
        </div>
        <div className={styles['admin-table__actions']}>
          {creator.status === 'active' && !suspending && (
            <Button
              variant="ghost"
              className={styles['admin-table__danger-button']}
              disabled={busy}
              onClick={() => setSuspending(true)}
            >
              Приостановить
            </Button>
          )}
          {creator.status === 'suspended' && (
            <Button variant="outline" disabled={busy} onClick={() => void handleReinstate()}>
              Восстановить
            </Button>
          )}
        </div>
      </div>

      {error && <p className={styles['admin-table__error']}>{error}</p>}

      {suspending && (
        <Modal onClose={() => setSuspending(false)} label={`Приостановить ${creator.user.name}`}>
          <div className={styles['admin-table__modal']}>
            <h2>Приостановить статус Creator?</h2>
            <textarea
              className={styles['admin-table__reason']}
              placeholder="Причина (необязательно)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
            />
            <div className={styles['admin-table__modal-actions']}>
              <Button variant="outline" onClick={() => setSuspending(false)}>
                Отмена
              </Button>
              <Button
                className={styles['admin-table__danger-button']}
                disabled={busy}
                onClick={() => void handleSuspend()}
              >
                Приостановить
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * Admin Creators (Creator Monetization Phase 1, AI_PLATFORM_ROADMAP.md §79) —
 * без очереди "approve/reject документ": верификация проходит автоматически
 * через Stripe Identity (см. backend `StripeIdentityWebhookController`),
 * поэтому здесь только фильтр по статусу + suspend/reinstate за нарушения
 * политики, не связанные с личностью.
 */
export function AdminCreatorsPanel() {
  const [filter, setFilter] = useState<CreatorStatus | 'all'>('all');
  const fetcher = useCallback(
    () => getAdminCreators(filter === 'all' ? undefined : filter),
    [filter],
  );
  const { status, data, error, refetch } = useAsyncData(fetcher);

  return (
    <div className={styles['admin-table']}>
      <div className={styles['admin-table__filters']}>
        <div className={styles['admin-table__filter-group']}>
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                styles['admin-table__filter-chip'],
                filter === item.id && styles['admin-table__filter-chip--active'],
              )}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {status === 'loading' && <Loader label="Загружаем creator'ов…" />}
      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}
      {status === 'success' && data && data.length === 0 && (
        <EmptyState title="По этому фильтру creator'ов нет" />
      )}
      {status === 'success' && data && data.length > 0 && (
        <div className={styles['admin-table__list']}>
          {data.map((creator) => (
            <CreatorRow key={creator.id} creator={creator} onChanged={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}
