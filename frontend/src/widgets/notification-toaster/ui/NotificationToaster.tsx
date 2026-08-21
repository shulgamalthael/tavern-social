'use client';

import { useFriendStore } from '@/entities/friend';
import { NotificationToast, useNotificationStore, useToastStore } from '@/entities/notification';
import { useThreadStore } from '@/entities/thread';
import { useNavigationStore } from '@/features/section-navigation';
import styles from './NotificationToaster.module.scss';

/**
 * Единственный виджет, который решает, что делать по клику на toast —
 * `NotificationToast` сам по себе не знает про навигацию/store'ы (см.
 * AGENTS.md, «UI не содержит бизнес-логику»). Монтируется один раз в
 * `app/home-app.tsx` рядом с `Header`.
 */
export function NotificationToaster() {
  const visible = useToastStore((state) => state.visible);
  const dismiss = useToastStore((state) => state.dismiss);
  const goToSection = useNavigationStore((state) => state.goToSection);
  const goToUserProfile = useNavigationStore((state) => state.goToUserProfile);
  const goToGroup = useNavigationStore((state) => state.goToGroup);
  const setActiveThread = useThreadStore((state) => state.setActiveThread);
  const acceptRequest = useFriendStore((state) => state.acceptRequest);
  const removeRequest = useFriendStore((state) => state.removeRequest);
  const markNotificationRead = useNotificationStore((state) => state.markRead);

  if (visible.length === 0) return null;

  return (
    <div className={styles.toaster} aria-live="polite">
      {visible.map((item) => (
        <NotificationToast
          key={item.id}
          item={item}
          onDismiss={() => dismiss(item.id)}
          onClick={() => {
            switch (item.kind) {
              case 'message':
                goToSection('messages');
                setActiveThread(item.threadId);
                break;
              case 'friend-request':
              case 'friend-accepted':
                goToSection('friends');
                break;
              case 'post-like':
              case 'post-repost':
              case 'post-comment':
                void markNotificationRead(item.notificationId);
                goToSection('profile');
                break;
              case 'group-join-request':
              case 'group-join-accepted':
                goToGroup(item.groupId);
                break;
            }
            dismiss(item.id);
          }}
          onAuthorClick={(authorId) => {
            goToUserProfile(authorId);
            dismiss(item.id);
          }}
          onAccept={
            item.kind === 'friend-request' ? () => void acceptRequest(item.senderId) : undefined
          }
          onDecline={
            item.kind === 'friend-request' ? () => void removeRequest(item.senderId) : undefined
          }
        />
      ))}
    </div>
  );
}
