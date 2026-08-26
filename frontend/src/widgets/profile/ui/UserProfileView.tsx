'use client';

import { useCallback, useEffect, useState } from 'react';
import { acceptFriendRequest, respondToFriendRequest, sendFriendRequest } from '@/entities/friend';
import {
  canDeletePost,
  canRepostPost,
  PostCard,
  PostCardSkeleton,
  usePostStore,
} from '@/entities/post';
import { useThreadStore } from '@/entities/thread';
import { getUserProfile, useCurrentUser, type UserProfile } from '@/entities/user';
import { PostComposer } from '@/features/publish-post';
import { useNavigationStore } from '@/features/section-navigation';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { useInfiniteScroll } from '@/shared/lib/use-infinite-scroll';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { IdBadge } from '@/shared/ui/IdBadge';
import { MediaPlaceholder } from '@/shared/ui/MediaPlaceholder';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import { AboutCard } from './AboutCard';
import { GalleryGrid } from './GalleryGrid';
import { ProfileFriendsCard } from './ProfileFriendsCard';
import { ProfilePageSkeleton } from './ProfilePageSkeleton';
import styles from './ProfileWidget.module.scss';

export interface UserProfileViewProps {
  userId: string;
}

const WALL_SKELETON_COUNT = 3;

type FriendshipFlags = Pick<UserProfile, 'isFriend' | 'hasOutgoingRequest' | 'hasIncomingRequest'>;

export function UserProfileView({ userId }: UserProfileViewProps) {
  const goToSection = useNavigationStore((state) => state.goToSection);
  const goToUserProfile = useNavigationStore((state) => state.goToUserProfile);
  const openDirectThreadWith = useThreadStore((state) => state.openDirectThreadWith);
  const wallPosts = usePostStore((state) => state.wallPostsByUserId[userId]) ?? [];
  const wallStatus = usePostStore((state) => state.wallStatusByUserId[userId] ?? 'idle');
  const wallError = usePostStore((state) => state.wallErrorByUserId[userId] ?? null);
  const loadWallPosts = usePostStore((state) => state.loadWallPosts);
  const wallNextCursor = usePostStore((state) => state.wallNextCursorByUserId[userId] ?? null);
  const wallLoadMoreStatus = usePostStore(
    (state) => state.wallLoadMoreStatusByUserId[userId] ?? 'idle',
  );
  const loadMoreWallPosts = usePostStore((state) => state.loadMoreWallPosts);
  const likedPostIds = usePostStore((state) => state.likedPostIds);
  const dislikedPostIds = usePostStore((state) => state.dislikedPostIds);
  const repostedPostIds = usePostStore((state) => state.repostedPostIds);
  const toggleLike = usePostStore((state) => state.toggleLike);
  const toggleDislike = usePostStore((state) => state.toggleDislike);
  const toggleRepost = usePostStore((state) => state.toggleRepost);
  const removePost = usePostStore((state) => state.removePost);
  const { currentUser } = useCurrentUser();
  const fetcher = useCallback(() => getUserProfile(userId), [userId]);
  const { status, data: profile, error, refetch } = useAsyncData(fetcher);
  // Локальный оверрайд статуса дружбы после действия — тот же паттерн, что
  // «Вступил в сообщество» в CommunitiesWidget (см. AGENTS.md, раздел 4).
  const [statusOverride, setStatusOverride] = useState<FriendshipFlags | null>(null);
  const wallSentinelRef = useInfiniteScroll(wallNextCursor, () => void loadMoreWallPosts(userId));

  useEffect(() => {
    void loadWallPosts(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- грузим один раз при открытии страницы пользователя
  }, [userId]);

  if (status === 'loading' || status === 'idle') {
    return <ProfilePageSkeleton />;
  }

  if (status === 'error' || !profile) {
    return (
      <SectionContainer>
        <ErrorState message={error} onRetry={refetch} />
      </SectionContainer>
    );
  }

  const friendship = statusOverride ?? profile;

  const onMessage = () => {
    goToSection('messages');
    openDirectThreadWith({
      id: userId,
      name: profile.name,
      initials: profile.initials,
      avatarUrl: profile.avatarUrl,
    });
  };

  return (
    <SectionContainer>
      <section className={styles['profile__card']}>
        {profile.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- обложка профиля, не оптимизируемый Next Image-контент
          <img
            src={profile.coverUrl}
            alt=""
            className={styles['profile__cover']}
            style={{
              display: 'block',
              height: 'clamp(120px, 22vw, 190px)',
              width: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <MediaPlaceholder
            label="обложка страницы · 1600×400"
            height="clamp(120px, 22vw, 190px)"
            flush
            className={styles['profile__cover']}
          />
        )}
        <div className={styles['profile__top']}>
          <Avatar initials={profile.initials} src={profile.avatarUrl} size="xl" bordered />
          <div className={styles['profile__titles']}>
            <span className={styles['profile__name']}>{profile.name}</span>
            {currentUser.role === 'admin' && <IdBadge id={userId} label="Пользователь" />}
            <span className={styles['profile__subtitle']}>
              {profile.tagline || 'Ещё не рассказали о себе'}
            </span>
          </div>
          <div className={styles['profile__actions']}>
            {friendship.isFriend && (
              <Button variant="soft" disabled>
                Вы друзья
              </Button>
            )}
            {!friendship.isFriend && friendship.hasOutgoingRequest && (
              <Button
                variant="outline"
                onClick={() => void respondToFriendRequest(userId).then(setStatusOverride)}
              >
                Заявка отправлена
              </Button>
            )}
            {!friendship.isFriend &&
              !friendship.hasOutgoingRequest &&
              friendship.hasIncomingRequest && (
                <Button
                  variant="primary"
                  onClick={() => void acceptFriendRequest(userId).then(setStatusOverride)}
                >
                  Принять заявку
                </Button>
              )}
            {!friendship.isFriend &&
              !friendship.hasOutgoingRequest &&
              !friendship.hasIncomingRequest && (
                <Button
                  variant="primary"
                  onClick={() => void sendFriendRequest(userId).then(setStatusOverride)}
                >
                  Добавить в друзья
                </Button>
              )}
            <Button variant="outline" onClick={onMessage}>
              Написать сообщение
            </Button>
          </div>
        </div>
      </section>

      <div className={styles['profile__grid']}>
        <div className={styles['profile__side']}>
          <AboutCard about={profile.about} city={profile.city} tags={profile.tags} isOwn={false} />

          <Card>
            <h2 className={styles['profile__card-title']}>Фотографии</h2>
            <GalleryGrid userId={userId} isOwn={false} />
          </Card>

          <ProfileFriendsCard userId={userId} />
        </div>

        <div className={styles['profile__wall']}>
          <PostComposer variant="wall" wallOwnerId={userId} />

          {wallStatus === 'loading' &&
            Array.from({ length: WALL_SKELETON_COUNT }, (_, index) => (
              <PostCardSkeleton key={index} />
            ))}
          {wallStatus === 'error' && (
            <ErrorState message={wallError} onRetry={() => loadWallPosts(userId)} />
          )}
          {wallStatus === 'success' && wallPosts.length === 0 && (
            <EmptyState
              title="На стене пока пусто"
              description="Здесь появятся записи этого пользователя."
            />
          )}
          {wallStatus === 'success' &&
            wallPosts.map((post) => {
              const targetId = post.repostOf?.id ?? post.id;
              return (
                <PostCard
                  key={`wall-${post.id}`}
                  post={post}
                  isLiked={Boolean(likedPostIds[targetId])}
                  isDisliked={Boolean(dislikedPostIds[targetId])}
                  isReposted={Boolean(repostedPostIds[targetId])}
                  onToggleLike={() => toggleLike(targetId)}
                  onToggleDislike={() => toggleDislike(targetId)}
                  onToggleRepost={
                    canRepostPost(post, currentUser.id) ? () => toggleRepost(targetId) : undefined
                  }
                  onAuthorClick={goToUserProfile}
                  onDelete={
                    canDeletePost(post, currentUser.id)
                      ? // Карточка репоста удаляется через `toggleRepost` (см.
                        // `entities/post/lib/can-delete-post.ts`), не через `removePost`.
                        () => void (post.repostOf ? toggleRepost(targetId) : removePost(post.id))
                      : undefined
                  }
                />
              );
            })}

          {wallStatus === 'success' && wallPosts.length > 0 && (
            <div ref={wallSentinelRef} aria-hidden="true" />
          )}
          {wallLoadMoreStatus === 'loading' && <PostCardSkeleton />}
        </div>
      </div>
    </SectionContainer>
  );
}
