'use client';

import { useEffect } from 'react';
import { useGroupStore } from '@/entities/group';
import { useInfiniteScroll } from '@/shared/lib/use-infinite-scroll';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import styles from './GroupMembersList.module.scss';

export interface GroupMembersListProps {
  groupId: string;
  /** Владелец видит кнопку «Удалить» у обычных участников (не у себя). */
  canManage?: boolean;
  onMemberClick?: (userId: string) => void;
}

/** Список участников группы — доступен всем участникам открытой группы,
 * только участникам приватной (backend отдаёт 403 остальным, см.
 * `GroupsService.listMembers`). */
export function GroupMembersList({
  groupId,
  canManage = false,
  onMemberClick,
}: GroupMembersListProps) {
  const members = useGroupStore((state) => state.membersByGroupId[groupId]) ?? [];
  const status = useGroupStore((state) => state.membersStatusByGroupId[groupId] ?? 'idle');
  const error = useGroupStore((state) => state.membersErrorByGroupId[groupId] ?? null);
  const nextCursor = useGroupStore((state) => state.membersNextCursorByGroupId[groupId] ?? null);
  const loadMembers = useGroupStore((state) => state.loadMembers);
  const loadMoreMembers = useGroupStore((state) => state.loadMoreMembers);
  const removeMember = useGroupStore((state) => state.removeMember);
  const sentinelRef = useInfiniteScroll(nextCursor, () => void loadMoreMembers(groupId));

  useEffect(() => {
    // Одобрение заявки (см. `useGroupStore.approveJoinRequest`) сбрасывает
    // статус в `idle`, чтобы список участников перечитался при следующем
    // открытии — эффект реагирует именно на это, а не только на смену группы.
    if (status === 'idle') void loadMembers(groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- перезагружаем при смене группы или после сброса статуса
  }, [groupId, status]);

  return (
    <div className={styles.list}>
      {status === 'loading' && <Loader label="Загружаем участников…" />}
      {status === 'error' && (
        <ErrorState message={error} onRetry={() => void loadMembers(groupId)} />
      )}
      {status === 'success' && members.length === 0 && <EmptyState title="Участников пока нет" />}

      {status === 'success' &&
        members.map((member) => (
          <div key={member.user.id} className={styles['list__row']}>
            <button
              type="button"
              className={styles['list__member-trigger']}
              onClick={() => onMemberClick?.(member.user.id)}
            >
              <Avatar initials={member.user.initials} src={member.user.avatarUrl} size="sm" />
              <span className={styles['list__name']}>{member.user.name}</span>
            </button>
            <span className={styles['list__role']}>
              {member.role === 'owner' ? 'Владелец' : 'Участник'}
            </span>
            {canManage && member.role !== 'owner' && (
              <Button variant="outline" onClick={() => void removeMember(groupId, member.user.id)}>
                Удалить
              </Button>
            )}
          </div>
        ))}

      {status === 'success' && members.length > 0 && <div ref={sentinelRef} aria-hidden="true" />}
    </div>
  );
}
