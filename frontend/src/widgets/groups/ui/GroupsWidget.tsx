'use client';

import { getGroups, GroupRow } from '@/entities/group';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { PageHead } from '@/shared/ui/PageHead';
import { SectionContainer } from '@/shared/ui/SectionContainer';

export function GroupsWidget() {
  const { status, data: groups, error, refetch } = useAsyncData(getGroups);

  return (
    <SectionContainer>
      <PageHead title="Группы" description="Свои столы: закрытый круг, только по приглашению" />

      {status === 'loading' && <Loader label="Загружаем группы…" />}
      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}

      {status === 'success' && groups && groups.length === 0 && (
        <EmptyState
          title="Групп пока нет"
          description="Свои столы появятся здесь, как только вас пригласят."
        />
      )}

      {status === 'success' && groups && groups.length > 0 && (
        <Card>
          {groups.map((group) => (
            <GroupRow key={group.id} group={group} />
          ))}
        </Card>
      )}
    </SectionContainer>
  );
}
