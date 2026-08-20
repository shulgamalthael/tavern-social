'use client';

import { PostCard, usePostStore } from '@/entities/post';
import { useCurrentUser } from '@/entities/user';
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
import styles from './ProfileWidget.module.scss';
import { UserProfileView } from './UserProfileView';

export function ProfileWidget() {
  const { currentUser } = useCurrentUser();
  const goToSection = useNavigationStore((state) => state.goToSection);
  const viewedUserId = useNavigationStore((state) => state.viewedUserId);
  const posts = usePostStore((state) => state.posts);
  const postsStatus = usePostStore((state) => state.status);
  const postsError = usePostStore((state) => state.error);
  const loadPosts = usePostStore((state) => state.loadPosts);
  // Стена — только записи самого пользователя, а не первые записи общей ленты.
  const wallPosts = posts.filter((post) => post.authorId === currentUser.id).slice(0, 3);

  if (viewedUserId && viewedUserId !== currentUser.id) {
    return <UserProfileView userId={viewedUserId} />;
  }

  return (
    <SectionContainer>
      <section className={styles['profile__card']}>
        <MediaPlaceholder
          label="обложка страницы · 1600×400"
          height="clamp(120px, 22vw, 190px)"
          flush
          className={styles['profile__cover']}
        />
        <div className={styles['profile__top']}>
          <Avatar initials={currentUser.initials} size="xl" bordered />
          <div className={styles['profile__titles']}>
            <span className={styles['profile__name']}>{currentUser.name}</span>
            <span className={styles['profile__subtitle']}>
              {currentUser.tagline || 'Ещё не рассказали о себе'}
            </span>
          </div>
          <div className={styles['profile__actions']}>
            <Button variant="outline" onClick={() => goToSection('settings')}>
              Править страницу
            </Button>
          </div>
        </div>
      </section>

      <div className={styles['profile__grid']}>
        <div className={styles['profile__side']}>
          <Card>
            <h2 className={styles['profile__card-title']}>О себе</h2>
            <EmptyState
              title="Пока нет информации о себе"
              description="Расскажите о себе в настройках — это появится здесь."
            />
          </Card>

          <Card>
            <h2 className={styles['profile__card-title']}>Фотографии</h2>
            <EmptyState title="Фотографий пока нет" />
          </Card>
        </div>

        <div className={styles['profile__wall']}>
          <PostComposer variant="wall" />

          {postsStatus === 'loading' && <Loader label="Загружаем стену…" />}
          {postsStatus === 'error' && <ErrorState message={postsError} onRetry={loadPosts} />}
          {postsStatus === 'success' && wallPosts.length === 0 && (
            <EmptyState
              title="На стене пока пусто"
              description="Напишите первую запись — она появится здесь и в общей ленте."
            />
          )}
          {postsStatus === 'success' &&
            wallPosts.map((post) => (
              <PostCard key={`wall-${post.id}`} post={post} variant="wall" />
            ))}
        </div>
      </div>
    </SectionContainer>
  );
}
