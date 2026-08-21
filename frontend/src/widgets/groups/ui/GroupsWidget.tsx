'use client';

import { useEffect, useState } from 'react';
import { GroupRow, GroupRowSkeleton, useGroupStore } from '@/entities/group';
import { GroupMembershipControl } from '@/features/group-membership';
import { GroupEditForm } from '@/features/manage-group';
import { useNavigationStore } from '@/features/section-navigation';
import { useInfiniteScroll } from '@/shared/lib/use-infinite-scroll';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Modal } from '@/shared/ui/Modal';
import { PageHead } from '@/shared/ui/PageHead';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import { GroupPageView } from './GroupPageView';
import styles from './GroupsWidget.module.scss';

const GROUPS_SKELETON_COUNT = 5;

export function GroupsWidget() {
  const viewedGroupId = useNavigationStore((state) => state.viewedGroupId);
  const goToGroup = useNavigationStore((state) => state.goToGroup);
  const groups = useGroupStore((state) => state.groups);
  const status = useGroupStore((state) => state.status);
  const error = useGroupStore((state) => state.error);
  const nextCursor = useGroupStore((state) => state.nextCursor);
  const loadMoreStatus = useGroupStore((state) => state.loadMoreStatus);
  const loadGroups = useGroupStore((state) => state.loadGroups);
  const loadMoreGroups = useGroupStore((state) => state.loadMoreGroups);
  const [isCreating, setCreating] = useState(false);
  const sentinelRef = useInfiniteScroll(nextCursor, () => void loadMoreGroups());

  useEffect(() => {
    if (status === 'idle') void loadGroups();
  }, [status, loadGroups]);

  if (viewedGroupId) {
    return <GroupPageView groupId={viewedGroupId} />;
  }

  return (
    <SectionContainer>
      <PageHead
        title="Группы"
        description="Открытые и приватные столы — свои сообщества по интересам"
      />

      <div className={styles['groups__toolbar']}>
        <Button onClick={() => setCreating(true)}>Создать группу</Button>
      </div>

      {(status === 'loading' || status === 'idle') && (
        <Card>
          {Array.from({ length: GROUPS_SKELETON_COUNT }, (_, index) => (
            <GroupRowSkeleton key={index} />
          ))}
        </Card>
      )}
      {status === 'error' && <ErrorState message={error} onRetry={() => void loadGroups()} />}

      {status === 'success' && groups.length === 0 && (
        <EmptyState
          title="Групп пока нет"
          description="Создайте первую группу — по интересам, столу или проекту."
          action={<Button onClick={() => setCreating(true)}>Создать группу</Button>}
        />
      )}

      {status === 'success' && groups.length > 0 && (
        <>
          <Card>
            {groups.map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                onOpen={goToGroup}
                actions={<GroupMembershipControl group={group} />}
              />
            ))}
          </Card>
          <div ref={sentinelRef} aria-hidden="true" />
          {loadMoreStatus === 'loading' && (
            <Card>
              <GroupRowSkeleton />
            </Card>
          )}
        </>
      )}

      {isCreating && (
        <Modal onClose={() => setCreating(false)} label="Новая группа">
          <GroupEditForm
            mode="create"
            onDone={(created) => {
              setCreating(false);
              if (created) goToGroup(created.id);
            }}
          />
        </Modal>
      )}
    </SectionContainer>
  );
}
