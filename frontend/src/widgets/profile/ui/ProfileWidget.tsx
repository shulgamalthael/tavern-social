'use client';

import { useEffect, useState } from 'react';
import { PostCard, usePostStore } from '@/entities/post';
import { useCurrentUser } from '@/entities/user';
import { ProfileEditForm } from '@/features/edit-profile';
import { PostComposer } from '@/features/publish-post';
import { useNavigationStore } from '@/features/section-navigation';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { MediaPlaceholder } from '@/shared/ui/MediaPlaceholder';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import { Tag } from '@/shared/ui/Tag';
import { GalleryGrid } from './GalleryGrid';
import styles from './ProfileWidget.module.scss';
import { UserProfileView } from './UserProfileView';

export function ProfileWidget() {
  const { currentUser } = useCurrentUser();
  const viewedUserId = useNavigationStore((state) => state.viewedUserId);
  const wallPosts = usePostStore((state) => state.wallPostsByUserId[currentUser.id]) ?? [];
  const wallStatus = usePostStore((state) => state.wallStatusByUserId[currentUser.id] ?? 'idle');
  const wallError = usePostStore((state) => state.wallErrorByUserId[currentUser.id] ?? null);
  const loadWallPosts = usePostStore((state) => state.loadWallPosts);
  const likedPostIds = usePostStore((state) => state.likedPostIds);
  const dislikedPostIds = usePostStore((state) => state.dislikedPostIds);
  const repostedPostIds = usePostStore((state) => state.repostedPostIds);
  const toggleLike = usePostStore((state) => state.toggleLike);
  const toggleDislike = usePostStore((state) => state.toggleDislike);
  const toggleRepost = usePostStore((state) => state.toggleRepost);
  const [isEditing, setEditing] = useState(false);

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
          <Card>
            <h2 className={styles['profile__card-title']}>О себе</h2>
            {currentUser.about || currentUser.city || currentUser.tags.length > 0 ? (
              <div className={styles['profile__about']}>
                {currentUser.about && <p>{currentUser.about}</p>}
                {currentUser.city && <p>Город: {currentUser.city}</p>}
                {currentUser.tags.length > 0 && (
                  <div className={styles['profile__tags']}>
                    {currentUser.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                title="Пока нет информации о себе"
                description="Расскажите о себе — нажмите «Править страницу»."
              />
            )}
          </Card>

          <Card>
            <h2 className={styles['profile__card-title']}>Фотографии</h2>
            <GalleryGrid userId={currentUser.id} isOwn />
          </Card>
        </div>

        <div className={styles['profile__wall']}>
          <PostComposer variant="wall" wallOwnerId={currentUser.id} />

          {wallStatus === 'loading' && <Loader label="Загружаем стену…" />}
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
                  variant="wall"
                  isLiked={Boolean(likedPostIds[targetId])}
                  isDisliked={Boolean(dislikedPostIds[targetId])}
                  isReposted={Boolean(repostedPostIds[targetId])}
                  onToggleLike={() => toggleLike(targetId)}
                  onToggleDislike={() => toggleDislike(targetId)}
                  onToggleRepost={() => toggleRepost(targetId)}
                />
              );
            })}
        </div>
      </div>
    </SectionContainer>
  );
}
