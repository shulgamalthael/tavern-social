'use client';

import { pluralizeRu } from '@/shared/lib/pluralize-ru';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import type { ToastItem } from '../model/toast-store';
import styles from './NotificationToast.module.scss';

export interface NotificationToastProps {
  item: ToastItem;
  onDismiss: () => void;
  onClick: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
}

function describe(item: ToastItem): { initials: string; title: string; body: string } {
  switch (item.kind) {
    case 'message':
      return { initials: item.senderInitials, title: item.senderName, body: item.preview };
    case 'friend-request':
      return {
        initials: item.senderInitials,
        title: item.senderName,
        body: 'хочет добавить вас в друзья',
      };
    case 'friend-accepted':
      return { initials: item.initials, title: item.name, body: 'принял(а) вашу заявку в друзья' };
    case 'post-like':
      return {
        initials: item.actorInitials,
        title: item.actorName,
        body:
          item.actorCount > 1
            ? `и ещё ${item.actorCount - 1} ${pluralizeRu(item.actorCount - 1, ['человек', 'человека', 'человек'])} оценили вашу запись`
            : 'оценил(а) вашу запись',
      };
    case 'post-repost':
      return {
        initials: item.actorInitials,
        title: item.actorName,
        body:
          item.actorCount > 1
            ? `и ещё ${item.actorCount - 1} ${pluralizeRu(item.actorCount - 1, ['человек', 'человека', 'человек'])} подняли вашу запись`
            : 'подняли вашу запись',
      };
    case 'post-comment':
      return {
        initials: item.actorInitials,
        title: item.actorName,
        body: item.commentText,
      };
  }
}

/** Компактный неблокирующий попап — только для отображения, вся логика
 * (навигация, сеть) приходит извне через колбэки (см. `widgets/notification-toaster`). */
export function NotificationToast({
  item,
  onDismiss,
  onClick,
  onAccept,
  onDecline,
}: NotificationToastProps) {
  const { initials, title, body } = describe(item);

  return (
    <Card as="article" className={styles.toast}>
      <button type="button" className={styles['toast__content']} onClick={onClick}>
        <Avatar initials={initials} size="sm" />
        <span className={styles['toast__body']}>
          <span className={styles['toast__title']}>{title}</span>
          <span className={styles['toast__text']}>{body}</span>
        </span>
      </button>

      {item.kind === 'friend-request' && (
        <div className={styles['toast__actions']}>
          <Button
            variant="primary"
            onClick={() => {
              onAccept?.();
              onDismiss();
            }}
          >
            Принять
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onDecline?.();
              onDismiss();
            }}
          >
            Отклонить
          </Button>
        </div>
      )}

      <button
        type="button"
        className={styles['toast__close']}
        aria-label="Закрыть уведомление"
        onClick={onDismiss}
      >
        ×
      </button>
    </Card>
  );
}
