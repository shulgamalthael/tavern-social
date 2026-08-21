'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CommunityCard,
  CommunityCardSkeleton,
  getCommunities,
  toggleCommunityMembership,
  type Community,
} from '@/entities/community';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { useInfiniteScroll } from '@/shared/lib/use-infinite-scroll';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { PageHead } from '@/shared/ui/PageHead';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import styles from './CommunitiesWidget.module.scss';

const COMMUNITIES_SKELETON_COUNT = 6;

/**
 * Витрина открытых сообществ — потенциально длинный список (см. AGENTS.md,
 * раздел про курсорную пагинацию), поэтому вместо `useAsyncData` — своя
 * пагинируемая загрузка тем же курсорным приёмом, что и в остальных списках
 * проекта. Без Zustand-стора: данные нужны только этому виджету (см.
 * AGENTS.md §4).
 */
export function CommunitiesWidget() {
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadMoreStatus, setLoadMoreStatus] = useState<AsyncStatus>('idle');
  const [reloadToken, setReloadToken] = useState(0);
  // Правки поверх загруженного списка — переключение членства не требует
  // полной перезагрузки всей сетки (без setState-в-эффекте, см. SettingsWidget).
  const [overrides, setOverrides] = useState<Record<string, Community>>({});

  useEffect(() => {
    let cancelled = false;

    getCommunities()
      .then(({ communities: firstPage, nextCursor: firstCursor }) => {
        if (cancelled) return;
        setCommunities(firstPage);
        setNextCursor(firstCursor);
        setLoadMoreStatus('idle');
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
  }, [reloadToken]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadMoreStatus === 'loading' || status !== 'success') return;
    setLoadMoreStatus('loading');
    try {
      const { communities: nextPage, nextCursor: newCursor } = await getCommunities(nextCursor);
      setCommunities((prev) => [...prev, ...nextPage]);
      setNextCursor(newCursor);
      setLoadMoreStatus('success');
    } catch {
      setLoadMoreStatus('error');
    }
  }, [nextCursor, loadMoreStatus, status]);

  const sentinelRef = useInfiniteScroll(nextCursor, () => void loadMore());
  const refetch = () => {
    setStatus('loading');
    setError(null);
    setReloadToken((token) => token + 1);
  };

  const toggleJoin = async (community: Community) => {
    const updated = await toggleCommunityMembership(community.id, !community.isJoined);
    setOverrides((prev) => ({ ...prev, [community.id]: updated }));
  };

  return (
    <SectionContainer>
      <PageHead title="Сообщества" description="Открытые залы, куда можно зайти без приглашения" />

      {status === 'loading' && (
        <div className={styles['communities__grid']}>
          {Array.from({ length: COMMUNITIES_SKELETON_COUNT }, (_, index) => (
            <CommunityCardSkeleton key={index} />
          ))}
        </div>
      )}
      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}

      {status === 'success' && communities.length === 0 && (
        <EmptyState
          title="Сообществ пока нет"
          description="Как только откроются залы, вы увидите их здесь."
        />
      )}

      {status === 'success' && communities.length > 0 && (
        <>
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
            {loadMoreStatus === 'loading' &&
              Array.from({ length: COMMUNITIES_SKELETON_COUNT }, (_, index) => (
                <CommunityCardSkeleton key={`more-${index}`} />
              ))}
          </div>
          <div ref={sentinelRef} aria-hidden="true" />
        </>
      )}
    </SectionContainer>
  );
}
