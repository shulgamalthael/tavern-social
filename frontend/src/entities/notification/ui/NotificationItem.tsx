'use client';

import { formatRelativeTime } from '@/shared/lib/format-relative-time';
import { pluralizeRu } from '@/shared/lib/pluralize-ru';
import { Avatar } from '@/shared/ui/Avatar';
import type { Notification } from '../model/types';
import styles from './NotificationItem.module.scss';

export interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

function describeBody(notification: Notification): string {
  const { type, actorCount, commentText } = notification;
  const extra = actorCount > 1 ? actorCount - 1 : 0;
  const others =
    extra > 0 ? ` и ещё ${extra} ${pluralizeRu(extra, ['человек', 'человека', 'человек'])}` : '';

  switch (type) {
    case 'friend_request':
      return 'хочет добавить вас в друзья';
    case 'friend_accepted':
      return 'принял(а) вашу заявку в друзья';
    case 'post_like':
      return `${others} оценил${extra > 0 ? 'и' : '(а)'} вашу запись`;
    case 'post_repost':
      return `${others} подня${extra > 0 ? 'ли' : 'л(а)'} вашу запись`;
    case 'post_comment':
      return commentText ?? '';
  }
}

/** Строка ленты уведомлений — в отличие от `NotificationToast` (одноразовый
 * попап) показывает полное время и визуально отличает прочитанное/непрочитанное. */
export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const { actor, isRead, createdAt } = notification;

  return (
    <button
      type="button"
      className={styles.item}
      data-unread={!isRead || undefined}
      onClick={onClick}
    >
      <Avatar initials={actor.initials} />
      <span className={styles['item__body']}>
        <span className={styles['item__text']}>
          <span className={styles['item__actor']}>{actor.name}</span> {describeBody(notification)}
        </span>
        <span className={styles['item__time']}>{formatRelativeTime(createdAt)}</span>
      </span>
      {!isRead && <span className={styles['item__dot']} aria-hidden="true" />}
    </button>
  );
}
