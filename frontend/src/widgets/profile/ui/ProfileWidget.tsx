'use client';

import { useEffect, useState } from 'react';
import {
  canDeletePost,
  canRepostPost,
  PostCard,
  PostCardSkeleton,
  usePostStore,
  type Post,
} from '@/entities/post';
import { useCurrentUser } from '@/entities/user';
import { ProfileEditForm } from '@/features/edit-profile';
import { EditPostModal, PostComposer } from '@/features/publish-post';
import { useNavigationStore } from '@/features/section-navigation';
import { useInfiniteScroll } from '@/shared/lib/use-infinite-scroll';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { MediaPlaceholder } from '@/shared/ui/MediaPlaceholder';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import { AboutCard } from './AboutCard';
import { GalleryGrid } from './GalleryGrid';
import { ProfileFriendsCard } from './ProfileFriendsCard';
import styles from './ProfileWidget.module.scss';
import { UserProfileView } from './UserProfileView';

const WALL_SKELETON_COUNT = 3;

export function ProfileWidget() {
  const { currentUser } = useCurrentUser();
  const viewedUserId = useNavigationStore((state) => state.viewedUserId);
  const goToUserProfile = useNavigationStore((state) => state.goToUserProfile);
  const wallPosts = usePostStore((state) => state.wallPostsByUserId[currentUser.id]) ?? [];
  const wallStatus = usePostStore((state) => state.wallStatusByUserId[currentUser.id] ?? 'idle');
  const wallError = usePostStore((state) => state.wallErrorByUserId[currentUser.id] ?? null);
  const loadWallPosts = usePostStore((state) => state.loadWallPosts);
  const wallNextCursor = usePostStore(
    (state) => state.wallNextCursorByUserId[currentUser.id] ?? null,
  );
  const wallLoadMoreStatus = usePostStore(
    (state) => state.wallLoadMoreStatusByUserId[currentUser.id] ?? 'idle',
  );
  const loadMoreWallPosts = usePostStore((state) => state.loadMoreWallPosts);
  const likedPostIds = usePostStore((state) => state.likedPostIds);
  const dislikedPostIds = usePostStore((state) => state.dislikedPostIds);
  const repostedPostIds = usePostStore((state) => state.repostedPostIds);
  const toggleLike = usePostStore((state) => state.toggleLike);
  const toggleDislike = usePostStore((state) => state.toggleDislike);
  const toggleRepost = usePostStore((state) => state.toggleRepost);
  const removePost = usePostStore((state) => state.removePost);
  const [isEditing, setEditing] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  // Удаление фото-поста со стены (см. onDelete ниже) чистит и связанную
  // GalleryImage на backend, но соседняя карточка «Фотографии» не подписана
  // на posts-стор (у неё нет своего стора, см. AGENTS.md §4) — форсим её
  // переmount/перезапрос сменой key, иначе там осталась бы битая плитка.
  const [galleryReloadKey, setGalleryReloadKey] = useState(0);
  const wallSentinelRef = useInfiniteScroll(
    wallNextCursor,
    () => void loadMoreWallPosts(currentUser.id),
  );

  useEffect(() => {
    void loadWallPosts(currentUser.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- грузим один раз при открытии своей страницы
  }, [currentUser.id]);

  if (viewedUserId && viewedUserId !== currentUser.id) {
    return <UserProfileView userId={viewedUserId} />;
  }

  if (isEditing) {
    return (
      <SectionContainer narrow>
        <ProfileEditForm onDone={() => setEditing(false)} />
      </SectionContainer>
    );
  }

  return (
    <SectionContainer>
      <section className={styles['profile__card']}>
        {currentUser.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- обложка профиля, не оптимизируемый Next Image-контент
          <img
            src={currentUser.coverUrl}
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
          <Avatar initials={currentUser.initials} src={currentUser.avatarUrl} size="xl" bordered />
          <div className={styles['profile__titles']}>
            <span className={styles['profile__name']}>{currentUser.name}</span>
            <span className={styles['profile__subtitle']}>
              {currentUser.tagline || 'Ещё не рассказали о себе'}
            </span>
          </div>
          <div className={styles['profile__actions']}>
            <Button variant="outline" onClick={() => setEditing(true)}>
              Править страницу
            </Button>
          </div>
        </div>
      </section>

      <div className={styles['profile__grid']}>
        <div className={styles['profile__side']}>
          <AboutCard
            about={currentUser.about}
            city={currentUser.city}
            tags={currentUser.tags}
            isOwn
          />

          <Card>
            <h2 className={styles['profile__card-title']}>Фотографии</h2>
            <GalleryGrid key={galleryReloadKey} userId={currentUser.id} isOwn />
          </Card>

          <ProfileFriendsCard userId={currentUser.id} />
        </div>

        <div className={styles['profile__wall']}>
          <PostComposer variant="wall" wallOwnerId={currentUser.id} />

          {wallStatus === 'loading' &&
            Array.from({ length: WALL_SKELETON_COUNT }, (_, index) => (
              <PostCardSkeleton key={index} />
            ))}
          {wallStatus === 'error' && (
            <ErrorState message={wallError} onRetry={() => loadWallPosts(currentUser.id)} />
          )}
          {wallStatus === 'success' && wallPosts.length === 0 && (
            <EmptyState
              title="На стене пока пусто"
              description="Напишите первую запись — она появится здесь и в общей ленте."
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
                        () =>
                          void (async () => {
                            if (post.repostOf) {
                              await toggleRepost(targetId);
                              return;
                            }
                            await removePost(post.id);
                            if (post.images.length > 0) setGalleryReloadKey((key) => key + 1);
                          })()
                      : undefined
                  }
                  onEdit={
                    canDeletePost(post, currentUser.id) && !post.repostOf
                      ? () => setEditingPost(post)
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

      {editingPost && <EditPostModal post={editingPost} onClose={() => setEditingPost(null)} />}
    </SectionContainer>
  );
}
