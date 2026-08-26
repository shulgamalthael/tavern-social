'use client';

import { useEffect } from 'react';
import {
  type Friend,
  FriendCard,
  FriendCardSkeleton,
  FriendRequestCard,
  useFriendStore,
} from '@/entities/friend';
import { useThreadStore } from '@/entities/thread';
import { useNavigationStore } from '@/features/section-navigation';
import { useInfiniteScroll } from '@/shared/lib/use-infinite-scroll';
import { Badge } from '@/shared/ui/Badge';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { PageHead } from '@/shared/ui/PageHead';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import styles from './FriendsWidget.module.scss';

const FRIENDS_SKELETON_COUNT = 6;

export function FriendsWidget() {
  const goToSection = useNavigationStore((state) => state.goToSection);
  const goToUserProfile = useNavigationStore((state) => state.goToUserProfile);
  const openDirectThreadWith = useThreadStore((state) => state.openDirectThreadWith);

  const friends = useFriendStore((state) => state.friends);
  const status = useFriendStore((state) => state.status);
  const error = useFriendStore((state) => state.error);
  const loadFriends = useFriendStore((state) => state.loadFriends);
  const nextCursor = useFriendStore((state) => state.nextCursor);
  const loadMoreStatus = useFriendStore((state) => state.loadMoreStatus);
  const loadMoreFriends = useFriendStore((state) => state.loadMoreFriends);
  const incoming = useFriendStore((state) => state.incoming);
  const outgoing = useFriendStore((state) => state.outgoing);
  const loadRequests = useFriendStore((state) => state.loadRequests);
  const acceptRequest = useFriendStore((state) => state.acceptRequest);
  const removeRequest = useFriendStore((state) => state.removeRequest);
  const removeFriend = useFriendStore((state) => state.removeFriend);
  const sentinelRef = useInfiniteScroll(nextCursor, () => void loadMoreFriends());

  useEffect(() => {
    void loadFriends();
    void loadRequests();
    // Один раз при заходе в раздел — дальше store поддерживает себя сам
    // (действия ниже и real-time события в app/home-app.tsx).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMessage = (friend: Friend) => {
    goToSection('messages');
    openDirectThreadWith({
      id: friend.id,
      name: friend.name,
      initials: friend.initials,
      avatarUrl: friend.avatarUrl,
    });
  };

  const requestsCount = incoming.length + outgoing.length;
  const hasRequests = requestsCount > 0;

  return (
    <SectionContainer>
      <PageHead
        title="Ваши люди"
        description="Все, с кем вы уже знакомы в зале — пишите без повода, дружба для этого не нужна."
      />

      {hasRequests && (
        <section className={styles['friends__requests']}>
          <h2 className={styles['friends__requests-title']}>
            Заявки в друзья
            <Badge variant="accent">{requestsCount}</Badge>
          </h2>
          <div className={styles['friends__requests-list']}>
            {incoming.map((request) => (
              <FriendRequestCard
                key={request.id}
                request={request}
                variant="incoming"
                onAccept={() => void acceptRequest(request.id)}
                onRemove={() => void removeRequest(request.id)}
                onAuthorClick={goToUserProfile}
              />
            ))}
            {outgoing.map((request) => (
              <FriendRequestCard
                key={request.id}
                request={request}
                variant="outgoing"
                onRemove={() => void removeRequest(request.id)}
                onAuthorClick={goToUserProfile}
              />
            ))}
          </div>
        </section>
      )}

      {status === 'loading' && (
        <div className={styles['friends__grid']}>
          {Array.from({ length: FRIENDS_SKELETON_COUNT }, (_, index) => (
            <FriendCardSkeleton key={index} />
          ))}
        </div>
      )}
      {status === 'error' && <ErrorState message={error} onRetry={loadFriends} />}

      {status === 'success' && friends.length === 0 && (
        <EmptyState
          title="У вас пока нет друзей"
          description="Как только кто-то станет вашим другом, вы увидите его здесь. А пока можно просто написать кому-нибудь — для этого дружба не нужна."
        />
      )}

      {status === 'success' && friends.length > 0 && (
        <>
          <div className={styles['friends__grid']}>
            {friends.map((friend) => (
              <FriendCard
                key={friend.id}
                friend={friend}
                onMessage={() => onMessage(friend)}
                onAuthorClick={goToUserProfile}
                onRemove={() => void removeFriend(friend.id)}
              />
            ))}
            {loadMoreStatus === 'loading' &&
              Array.from({ length: 3 }, (_, index) => <FriendCardSkeleton key={index} />)}
          </div>
          <div ref={sentinelRef} aria-hidden="true" />
        </>
      )}
    </SectionContainer>
  );
}
