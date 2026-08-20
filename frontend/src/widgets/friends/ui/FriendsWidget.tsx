'use client';

import { useEffect } from 'react';
import { FriendCard, FriendRequestCard, useFriendStore } from '@/entities/friend';
import { useThreadStore } from '@/entities/thread';
import { useNavigationStore } from '@/features/section-navigation';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { PageHead } from '@/shared/ui/PageHead';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import styles from './FriendsWidget.module.scss';

export function FriendsWidget() {
  const goToSection = useNavigationStore((state) => state.goToSection);
  const openDirectThreadWith = useThreadStore((state) => state.openDirectThreadWith);

  const friends = useFriendStore((state) => state.friends);
  const status = useFriendStore((state) => state.status);
  const error = useFriendStore((state) => state.error);
  const loadFriends = useFriendStore((state) => state.loadFriends);
  const incoming = useFriendStore((state) => state.incoming);
  const outgoing = useFriendStore((state) => state.outgoing);
  const loadRequests = useFriendStore((state) => state.loadRequests);
  const acceptRequest = useFriendStore((state) => state.acceptRequest);
  const removeRequest = useFriendStore((state) => state.removeRequest);

  useEffect(() => {
    void loadFriends();
    void loadRequests();
    // Один раз при заходе в раздел — дальше store поддерживает себя сам
    // (действия ниже и real-time события в app/home-app.tsx).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMessage = (friendId: string) => {
    goToSection('messages');
    void openDirectThreadWith(friendId);
  };

  const hasRequests = incoming.length > 0 || outgoing.length > 0;

  return (
    <SectionContainer>
      <PageHead title="Друзья" />

      {hasRequests && (
        <div className={styles['friends__requests']}>
          <h2 className={styles['friends__requests-title']}>Заявки в друзья</h2>
          <div className={styles['friends__list']}>
            {incoming.map((request) => (
              <FriendRequestCard
                key={request.id}
                request={request}
                variant="incoming"
                onAccept={() => void acceptRequest(request.id)}
                onRemove={() => void removeRequest(request.id)}
              />
            ))}
            {outgoing.map((request) => (
              <FriendRequestCard
                key={request.id}
                request={request}
                variant="outgoing"
                onRemove={() => void removeRequest(request.id)}
              />
            ))}
          </div>
        </div>
      )}

      {status === 'loading' && <Loader label="Загружаем друзей…" />}
      {status === 'error' && <ErrorState message={error} onRetry={loadFriends} />}

      {status === 'success' && friends.length === 0 && (
        <EmptyState
          title="У вас пока нет друзей"
          description="Как только кто-то станет вашим другом, вы увидите его здесь."
        />
      )}

      {status === 'success' && friends.length > 0 && (
        <div className={styles['friends__list']}>
          {friends.map((friend) => (
            <FriendCard key={friend.id} friend={friend} onMessage={() => onMessage(friend.id)} />
          ))}
        </div>
      )}
    </SectionContainer>
  );
}
