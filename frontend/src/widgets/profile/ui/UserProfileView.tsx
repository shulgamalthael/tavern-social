'use client';

import { useCallback, useEffect, useState } from 'react';
import { followUser, unfollowUser } from '@/entities/follow';
import { acceptFriendRequest, respondToFriendRequest, sendFriendRequest } from '@/entities/friend';
import {
  canDeletePost,
  canRepostPost,
  PostCard,
  PostCardSkeleton,
  usePostStore,
} from '@/entities/post';
import { getUserStories, markStoryViewed, StoryAvatar } from '@/entities/story';
import { useThreadStore } from '@/entities/thread';
import { getUserProfile, useCurrentUser, type UserProfile } from '@/entities/user';
import { PostComposer } from '@/features/publish-post';
import { useNavigationStore } from '@/features/section-navigation';
import { StoryViewer } from '@/features/stories';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { useInfiniteScroll } from '@/shared/lib/use-infinite-scroll';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { IdBadge } from '@/shared/ui/IdBadge';
import { LockedState } from '@/shared/ui/LockedState';
import { MediaPlaceholder } from '@/shared/ui/MediaPlaceholder';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import { AboutCard } from './AboutCard';
import { GalleryGrid } from './GalleryGrid';
import { ProfileBadgesCard } from './ProfileBadgesCard';
import { ProfileFollowStatsCard } from './ProfileFollowStatsCard';
import { ProfileFriendsCard } from './ProfileFriendsCard';
import { ProfilePageSkeleton } from './ProfilePageSkeleton';
import styles from './ProfileWidget.module.scss';

export interface UserProfileViewProps {
  userId: string;
}

const WALL_SKELETON_COUNT = 3;

type FriendshipFlags = Pick<UserProfile, 'isFriend' | 'hasOutgoingRequest' | 'hasIncomingRequest'>;
type FollowFlags = Pick<
  UserProfile,
  'isFollowing' | 'followersCount' | 'hasPendingSubscriptionRequest'
>;

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
  const storiesFetcher = useCallback(() => getUserStories(userId), [userId]);
  const { data: storyGroup } = useAsyncData(storiesFetcher);
  const [isStoryViewerOpen, setStoryViewerOpen] = useState(false);
  // Локальный оверрайд статуса дружбы после действия — тот же паттерн, что
  // «Вступил в сообщество» в CommunitiesWidget (см. AGENTS.md, раздел 4).
  const [statusOverride, setStatusOverride] = useState<FriendshipFlags | null>(null);
  // Тот же приём для подписки — независимой от дружбы сущности (§85). Хранит
  // и счётчик подписчиков, не только флаг: сервер отдаёт только
  // `{isFollowing}`, счётчик подбирается на клиенте (+1/-1), чтобы
  // «красивый счётчик» в шапке обновлялся сразу же, не только после
  // перезагрузки страницы.
  const [followOverride, setFollowOverride] = useState<FollowFlags | null>(null);
  const wallSentinelRef = useInfiniteScroll(wallNextCursor, () => void loadMoreWallPosts(userId));

  useEffect(() => {
    // Приватный профиль без доступа (§103) — стену не запрашиваем вовсе,
    // сервер всё равно ответит 403 (см. `PostsService.listWall`).
    if (profile?.canViewFullProfile) {
      void loadWallPosts(userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- грузим один раз при открытии страницы (или когда появился доступ)
  }, [userId, profile?.canViewFullProfile]);

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
  const follow: FollowFlags = followOverride ?? {
    isFollowing: profile.isFollowing,
    followersCount: profile.followersCount,
    hasPendingSubscriptionRequest: profile.hasPendingSubscriptionRequest,
  };

  // Отписка и отмена ещё не одобренной заявки на подписку (§103) — одна и та
  // же кнопка/операция на backend (см. `SubscriptionsService.unsubscribe`).
  const handleFollowToggle = async () => {
    const shouldUnfollow = follow.isFollowing || follow.hasPendingSubscriptionRequest;
    const result = shouldUnfollow ? await unfollowUser(userId) : await followUser(userId);
    const delta = result.isFollowing === follow.isFollowing ? 0 : result.isFollowing ? 1 : -1;
    setFollowOverride({
      isFollowing: result.isFollowing,
      hasPendingSubscriptionRequest: result.hasPendingRequest,
      followersCount: Math.max(0, follow.followersCount + delta),
    });
  };

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
          <StoryAvatar
            group={
              storyGroup ?? {
                author: {
                  id: userId,
                  name: profile.name,
                  initials: profile.initials,
                  avatarUrl: profile.avatarUrl,
                },
                stories: [],
                hasUnseen: false,
              }
            }
            size="xl"
            onClick={() => setStoryViewerOpen(true)}
          />
          <div className={styles['profile__titles']}>
            <span className={styles['profile__name']}>{profile.name}</span>
            {currentUser.role === 'admin' && <IdBadge id={userId} label="Пользователь" />}
            <span className={styles['profile__subtitle']}>
              {profile.tagline || 'Ещё не рассказали о себе'}
            </span>
          </div>
          <div className={styles['profile__actions']}>
            {/* Подписка — независимо от дружбы (§85), обе кнопки показываются
                одновременно, никогда не взаимоисключающе. */}
            {follow.isFollowing ? (
              <Button variant="outline" onClick={() => void handleFollowToggle()}>
                Отписаться
              </Button>
            ) : profile.isPrivate ? (
              follow.hasPendingSubscriptionRequest ? (
                <Button variant="outline" onClick={() => void handleFollowToggle()}>
                  Запрос отправлен
                </Button>
              ) : (
                <Button variant="primary" onClick={() => void handleFollowToggle()}>
                  Запросить подписку
                </Button>
              )
            ) : (
              <Button variant="primary" onClick={() => void handleFollowToggle()}>
                Подписаться
              </Button>
            )}
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

      {profile.canViewFullProfile ? (
        <div className={styles['profile__grid']}>
          <div className={styles['profile__side']}>
            <ProfileBadgesCard
              role={profile.role}
              creatorStatus={profile.creatorStatus}
              businesses={profile.businesses}
              isPrivate={profile.isPrivate}
            />

            <ProfileFollowStatsCard
              userId={userId}
              followersCount={follow.followersCount}
              followingCount={profile.followingCount}
            />

            <AboutCard
              about={profile.about}
              city={profile.city}
              tags={profile.tags}
              isOwn={false}
            />

            <Card>
              <h2 className={styles['profile__card-title']}>Фотографии</h2>
              <GalleryGrid userId={userId} isOwn={false} />
            </Card>

            <ProfileFriendsCard userId={userId} friendsCount={profile.friendsCount} />
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
      ) : (
        <>
          {/* Счётчики видны и без доступа (по просьбе продукта) — только не
              кликабельны: сами списки за ними всё равно вернут 403 (см.
              `UsersController.getFollowers`/`getFollowing`/`getFriends`). */}
          <ProfileFollowStatsCard
            userId={userId}
            followersCount={follow.followersCount}
            followingCount={profile.followingCount}
            friendsCount={profile.friendsCount}
            interactive={false}
          />
          <LockedState
            title="Эта страница приватная"
            description="Станьте другом или подпишитесь, чтобы видеть стену, фотографии и друзей."
          />
        </>
      )}
      {isStoryViewerOpen && storyGroup && storyGroup.stories.length > 0 && (
        <StoryViewer
          groups={[storyGroup]}
          startGroupIndex={0}
          currentUserId={currentUser.id}
          onClose={() => setStoryViewerOpen(false)}
          onStoryViewed={(storyId) => void markStoryViewed(storyId)}
        />
      )}
    </SectionContainer>
  );
}
