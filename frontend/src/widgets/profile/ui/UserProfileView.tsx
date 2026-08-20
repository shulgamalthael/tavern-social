'use client';

import { useCallback, useState } from 'react';
import { acceptFriendRequest, respondToFriendRequest, sendFriendRequest } from '@/entities/friend';
import { PostCard, usePostStore } from '@/entities/post';
import { useThreadStore } from '@/entities/thread';
import { getUserProfile, type UserProfile } from '@/entities/user';
import { useNavigationStore } from '@/features/section-navigation';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { MediaPlaceholder } from '@/shared/ui/MediaPlaceholder';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import { Tag } from '@/shared/ui/Tag';
import styles from './ProfileWidget.module.scss';

export interface UserProfileViewProps {
  userId: string;
}

type FriendshipFlags = Pick<UserProfile, 'isFriend' | 'hasOutgoingRequest' | 'hasIncomingRequest'>;

export function UserProfileView({ userId }: UserProfileViewProps) {
  const goToSection = useNavigationStore((state) => state.goToSection);
  const openDirectThreadWith = useThreadStore((state) => state.openDirectThreadWith);
  const posts = usePostStore((state) => state.posts);
  const fetcher = useCallback(() => getUserProfile(userId), [userId]);
  const { status, data: profile, error, refetch } = useAsyncData(fetcher);
  // Локальный оверрайд статуса дружбы после действия — тот же паттерн, что
  // «Вступил в сообщество» в CommunitiesWidget (см. AGENTS.md, раздел 4).
  const [statusOverride, setStatusOverride] = useState<FriendshipFlags | null>(null);

  if (status === 'loading' || status === 'idle') {
    return (
      <SectionContainer>
        <Loader label="Загружаем страницу…" />
      </SectionContainer>
    );
  }

  if (status === 'error' || !profile) {
    return (
      <SectionContainer>
        <ErrorState message={error} onRetry={refetch} />
      </SectionContainer>
    );
  }

  const friendship = statusOverride ?? profile;
  const wallPosts = posts.filter((post) => post.authorId === userId).slice(0, 3);

  const onMessage = () => {
    goToSection('messages');
    void openDirectThreadWith(userId);
  };

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
          <Avatar initials={profile.initials} size="xl" bordered />
          <div className={styles['profile__titles']}>
            <span className={styles['profile__name']}>{profile.name}</span>
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
          <Card>
            <h2 className={styles['profile__card-title']}>О себе</h2>
            {profile.about || profile.city || profile.tags.length > 0 ? (
              <div className={styles['profile__about']}>
                {profile.about && <p>{profile.about}</p>}
                {profile.city && <p>Город: {profile.city}</p>}
                {profile.tags.length > 0 && (
                  <div className={styles['profile__tags']}>
                    {profile.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState title="Пока нет информации о себе" />
            )}
          </Card>
        </div>

        <div className={styles['profile__wall']}>
          {wallPosts.length === 0 ? (
            <EmptyState
              title="На стене пока пусто"
              description="Здесь появятся записи этого пользователя."
            />
          ) : (
            wallPosts.map((post) => <PostCard key={`wall-${post.id}`} post={post} variant="wall" />)
          )}
        </div>
      </div>
    </SectionContainer>
  );
}
