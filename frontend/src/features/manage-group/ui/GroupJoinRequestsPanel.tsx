'use client';

import { useEffect } from 'react';
import { useGroupStore } from '@/entities/group';
import { useInfiniteScroll } from '@/shared/lib/use-infinite-scroll';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import styles from './GroupJoinRequestsPanel.module.scss';

export interface GroupJoinRequestsPanelProps {
  groupId: string;
}

/** Список заявок на вступление в приватную группу — только для владельца
 * (backend отдаёт 403 остальным, см. `GroupsService.listJoinRequests`). */
export function GroupJoinRequestsPanel({ groupId }: GroupJoinRequestsPanelProps) {
  const requests = useGroupStore((state) => state.joinRequestsByGroupId[groupId]) ?? [];
  const status = useGroupStore((state) => state.joinRequestsStatusByGroupId[groupId] ?? 'idle');
  const error = useGroupStore((state) => state.joinRequestsErrorByGroupId[groupId] ?? null);
  const nextCursor = useGroupStore(
    (state) => state.joinRequestsNextCursorByGroupId[groupId] ?? null,
  );
  const loadJoinRequests = useGroupStore((state) => state.loadJoinRequests);
  const loadMoreJoinRequests = useGroupStore((state) => state.loadMoreJoinRequests);
  const approveJoinRequest = useGroupStore((state) => state.approveJoinRequest);
  const rejectJoinRequest = useGroupStore((state) => state.rejectJoinRequest);
  const sentinelRef = useInfiniteScroll(nextCursor, () => void loadMoreJoinRequests(groupId));

  useEffect(() => {
    void loadJoinRequests(groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- грузим один раз при открытии панели
  }, [groupId]);

  return (
    <div className={styles.panel}>
      <h2 className={styles['panel__title']}>Заявки на вступление</h2>

      {status === 'loading' && <Loader label="Загружаем…" />}
      {status === 'error' && (
        <ErrorState message={error} onRetry={() => void loadJoinRequests(groupId)} />
      )}
      {status === 'success' && requests.length === 0 && (
        <EmptyState
          title="Заявок пока нет"
          description="Как только кто-то попросится в группу, заявка появится здесь."
        />
      )}

      {status === 'success' &&
        requests.map((request) => (
          <div key={request.user.id} className={styles['panel__row']}>
            <Avatar initials={request.user.initials} src={request.user.avatarUrl} size="sm" />
            <span className={styles['panel__name']}>{request.user.name}</span>
            <div className={styles['panel__actions']}>
              <Button
                variant="primary"
                onClick={() => void approveJoinRequest(groupId, request.user.id)}
              >
                Принять
              </Button>
              <Button
                variant="outline"
                onClick={() => void rejectJoinRequest(groupId, request.user.id)}
              >
                Отклонить
              </Button>
            </div>
          </div>
        ))}

      {status === 'success' && requests.length > 0 && <div ref={sentinelRef} aria-hidden="true" />}
    </div>
  );
}
