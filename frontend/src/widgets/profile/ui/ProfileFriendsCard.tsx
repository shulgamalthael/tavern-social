'use client';

import { useCallback, useState } from 'react';
import { getUserFriends, removeFriend, type Friend } from '@/entities/friend';
import { useCurrentUser } from '@/entities/user';
import { useNavigationStore } from '@/features/section-navigation';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Avatar } from '@/shared/ui/Avatar';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { FriendsListModal } from './FriendsListModal';
import styles from './ProfileFriendsCard.module.scss';
import profileStyles from './ProfileWidget.module.scss';

export interface ProfileFriendsCardProps {
  userId: string;
}

/** Столько плиток показывает превью-сетка — как и с фотографиями
 * (`GalleryGrid`, `MAX_VISIBLE_TILES`): 8 настоящих друзей + одна плитка
 * «+N», если друзей больше. Полный список — по клику на «+N», в поиске. */
const MAX_VISIBLE_TILES = 9;
const SKELETON_COUNT = 6;

export function ProfileFriendsCard({ userId }: ProfileFriendsCardProps) {
  const fetcher = useCallback(() => getUserFriends(userId), [userId]);
  const { status, data, error, refetch } = useAsyncData(fetcher);
  const [overrideFriends, setOverrideFriends] = useState<Friend[] | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const goToUserProfile = useNavigationStore((state) => state.goToUserProfile);
  const { currentUser } = useCurrentUser();
  // Разрыв дружбы имеет смысл только на своей странице — на чужой это была бы
  // попытка расторгнуть дружбу за другого человека.
  const isOwn = userId === currentUser.id;

  const friends = overrideFriends ?? data ?? [];
  const hasOverflow = friends.length > MAX_VISIBLE_TILES;
  const visibleFriends = hasOverflow ? friends.slice(0, MAX_VISIBLE_TILES - 1) : friends;
  const hiddenCount = friends.length - visibleFriends.length;

  const handleRemove = isOwn
    ? async (friendId: string) => {
        await removeFriend(friendId);
        setOverrideFriends(friends.filter((friend) => friend.id !== friendId));
      }
    : undefined;

  return (
    <Card>
      <h2 className={profileStyles['profile__card-title']}>Друзья</h2>

      {(status === 'loading' || status === 'idle') && (
        <div className={styles['friends__grid']}>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <div key={index} className={styles['friends__skeleton-tile']}>
              <Skeleton width={62} height={62} radius="50%" />
              <Skeleton width="80%" height={11} />
            </div>
          ))}
        </div>
      )}

      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}

      {status === 'success' && friends.length === 0 && <EmptyState title="Пока нет друзей" />}

      {status === 'success' && friends.length > 0 && (
        <div className={styles['friends__grid']}>
          {visibleFriends.map((friend) => (
            <div key={friend.id} className={styles['friends__tile-wrap']}>
              <button
                type="button"
                className={styles['friends__tile']}
                onClick={() => goToUserProfile(friend.id)}
              >
                <Avatar initials={friend.initials} src={friend.avatarUrl} size="lg" />
                <span className={styles['friends__name']}>{friend.name}</span>
              </button>
              {handleRemove && (
                <button
                  type="button"
                  className={styles['friends__delete']}
                  onClick={() => void handleRemove(friend.id)}
                  aria-label={`Удалить ${friend.name} из друзей`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              className={styles['friends__tile']}
              onClick={() => setModalOpen(true)}
              aria-label={`Показать всех друзей — ещё ${hiddenCount}`}
            >
              <span className={styles['friends__more']} aria-hidden="true">
                +{hiddenCount}
              </span>
              <span className={styles['friends__name']}>Ещё</span>
            </button>
          )}
        </div>
      )}

      {isModalOpen && (
        <FriendsListModal
          friends={friends}
          onClose={() => setModalOpen(false)}
          onSelectFriend={(friendId) => {
            setModalOpen(false);
            goToUserProfile(friendId);
          }}
          onRemoveFriend={handleRemove}
        />
      )}
    </Card>
  );
}
