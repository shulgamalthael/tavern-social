'use client';

import { useState } from 'react';
import {
  CommunityCard,
  getCommunities,
  toggleCommunityMembership,
  type Community,
} from '@/entities/community';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { PageHead } from '@/shared/ui/PageHead';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import styles from './CommunitiesWidget.module.scss';

export function CommunitiesWidget() {
  const { status, data: communities, error, refetch } = useAsyncData(getCommunities);
  // Правки поверх загруженного списка — переключение членства не требует
  // полной перезагрузки всей сетки (без setState-в-эффекте, см. SettingsWidget).
  const [overrides, setOverrides] = useState<Record<string, Community>>({});

  const toggleJoin = async (community: Community) => {
    const updated = await toggleCommunityMembership(community.id, !community.isJoined);
    setOverrides((prev) => ({ ...prev, [community.id]: updated }));
  };

  return (
    <SectionContainer>
      <PageHead title="Сообщества" description="Открытые залы, куда можно зайти без приглашения" />

      {status === 'loading' && <Loader label="Загружаем сообщества…" />}
      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}

      {status === 'success' && communities && communities.length === 0 && (
        <EmptyState
          title="Сообществ пока нет"
          description="Как только откроются залы, вы увидите их здесь."
        />
      )}

      {status === 'success' && communities && communities.length > 0 && (
        <div className={styles['communities__grid']}>
          {communities.map((community) => {
            const current = overrides[community.id] ?? community;
            return (
              <CommunityCard
                key={current.id}
                community={current}
                isJoined={current.isJoined}
                onToggleJoin={() => void toggleJoin(current)}
              />
            );
          })}
        </div>
      )}
    </SectionContainer>
  );
}
