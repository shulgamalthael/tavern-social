'use client';

import type { MouseEvent } from 'react';
import { formatRelativeTime } from '@/shared/lib/format-relative-time';
import { pluralizeRu } from '@/shared/lib/pluralize-ru';
import { Avatar } from '@/shared/ui/Avatar';
import { useNotificationStore } from '../model/notification-store';
import type { Notification } from '../model/types';
import styles from './NotificationItem.module.scss';

export interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  /** Клик по аватару/имени — переход на профиль автора действия, отдельно
   * от клика по остальной строке (переход туда, куда ведёт сам тип
   * уведомления, см. `onClick`). */
  onAuthorClick?: (actorId: string) => void;
}

function describeBody(notification: Notification): string {
  const { type, actorCount, commentText, post, group } = notification;
  const extra = actorCount > 1 ? actorCount - 1 : 0;
  const others =
    extra > 0 ? ` и ещё ${extra} ${pluralizeRu(extra, ['человек', 'человека', 'человек'])}` : '';
  // Фото галереи — тоже Post (см. AGENTS.md), но текст уведомления должен
  // честно называть его фотографией, а не «записью».
  const target = post?.hasImage ? 'вашу фотографию' : 'вашу запись';

  switch (type) {
    case 'friend_request':
      return 'хочет добавить вас в друзья';
    case 'friend_accepted':
      return 'принял(а) вашу заявку в друзья';
    case 'subscription_request':
      return 'хочет подписаться на вашу страницу';
    case 'subscription_accepted':
      return 'одобрил(а) вашу заявку на подписку';
    case 'post_like':
      return `${others} оценил${extra > 0 ? 'и' : '(а)'} ${target}`;
    case 'post_repost':
      return `${others} подня${extra > 0 ? 'ли' : 'л(а)'} ${target}`;
    case 'post_comment':
      return commentText ?? '';
    case 'group_join_request':
      return `хочет вступить в группу «${group?.name ?? ''}»`;
    case 'group_join_accepted':
      return `принял(а) вашу заявку в группу «${group?.name ?? ''}»`;
  }
}

/** Строка ленты уведомлений — в отличие от `NotificationToast` (одноразовый
 * попап) показывает полное время и визуально отличает прочитанное/непрочитанное.
 *
 * Раньше вся строка была одной кнопкой с одним и тем же переходом. Аватар и
 * имя — отдельные `button` с `stopPropagation`, ведущие на профиль автора
 * действия; остальная часть строки по-прежнему ведёт туда, куда указывает
 * тип уведомления (заявка в друзья — в раздел «Друзья», лайк/комментарий —
 * на свою запись, см. `onClick` у вызывающего). Обёртка — `div role="button"`,
 * а не `button`, потому что вложенные `<button>` внутри `<button>` — невалидный
 * HTML (браузер сам разорвал бы вложенность и сломал клики).
 */
export function NotificationItem({ notification, onClick, onAuthorClick }: NotificationItemProps) {
  const { id, actor, isRead, createdAt } = notification;
  const markRead = useNotificationStore((state) => state.markRead);

  const stopAndOpenAuthor = (event: MouseEvent) => {
    event.stopPropagation();
    onAuthorClick?.(actor.id);
  };

  return (
    <div
      className={styles.item}
      data-unread={!isRead || undefined}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onClick();
      }}
      // Наведение — тот же сигнал внимания, что и клик: непрочитанное
      // уведомление помечается прочитанным, даже если пользователь так и не
      // кликнет по нему (просто увидел текст, наведя курсор).
      onMouseEnter={() => {
        if (!isRead) void markRead(id);
      }}
    >
      <button type="button" className={styles['item__avatar-trigger']} onClick={stopAndOpenAuthor}>
        <Avatar initials={actor.initials} src={actor.avatarUrl} />
      </button>
      <span className={styles['item__body']}>
        <span className={styles['item__text']}>
          <button
            type="button"
            className={styles['item__actor-trigger']}
            onClick={stopAndOpenAuthor}
          >
            <span className={styles['item__actor']}>{actor.name}</span>
          </button>{' '}
          {describeBody(notification)}
        </span>
        <span className={styles['item__time']}>{formatRelativeTime(createdAt)}</span>
      </span>
      {!isRead && <span className={styles['item__dot']} aria-hidden="true" />}
    </div>
  );
}
