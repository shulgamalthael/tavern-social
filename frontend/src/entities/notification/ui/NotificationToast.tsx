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
  /** Клик по аватару/имени — переход на профиль автора действия, отдельно
   * от основного клика по тосту (см. `onClick`). */
  onAuthorClick?: (authorId: string) => void;
  onAccept?: () => void;
  onDecline?: () => void;
}

function describe(item: ToastItem): {
  authorId: string;
  initials: string;
  avatarUrl: string | null;
  title: string;
  body: string;
} {
  switch (item.kind) {
    case 'message':
      return {
        authorId: item.senderId,
        initials: item.senderInitials,
        avatarUrl: item.senderAvatarUrl,
        title: item.senderName,
        body: item.preview,
      };
    case 'friend-request':
      return {
        authorId: item.senderId,
        initials: item.senderInitials,
        avatarUrl: item.senderAvatarUrl,
        title: item.senderName,
        body: 'хочет добавить вас в друзья',
      };
    case 'friend-accepted':
      return {
        authorId: item.actorId,
        initials: item.initials,
        avatarUrl: item.avatarUrl,
        title: item.name,
        body: 'принял(а) вашу заявку в друзья',
      };
    case 'post-like': {
      const target = item.hasImage ? 'вашу фотографию' : 'вашу запись';
      return {
        authorId: item.actorId,
        initials: item.actorInitials,
        avatarUrl: item.actorAvatarUrl,
        title: item.actorName,
        body:
          item.actorCount > 1
            ? `и ещё ${item.actorCount - 1} ${pluralizeRu(item.actorCount - 1, ['человек', 'человека', 'человек'])} оценили ${target}`
            : `оценил(а) ${target}`,
      };
    }
    case 'post-repost': {
      const target = item.hasImage ? 'вашу фотографию' : 'вашу запись';
      return {
        authorId: item.actorId,
        initials: item.actorInitials,
        avatarUrl: item.actorAvatarUrl,
        title: item.actorName,
        body:
          item.actorCount > 1
            ? `и ещё ${item.actorCount - 1} ${pluralizeRu(item.actorCount - 1, ['человек', 'человека', 'человек'])} подняли ${target}`
            : `подняли ${target}`,
      };
    }
    case 'post-comment':
      return {
        authorId: item.actorId,
        initials: item.actorInitials,
        avatarUrl: item.actorAvatarUrl,
        title: item.actorName,
        body: item.commentText,
      };
    case 'group-join-request':
      return {
        authorId: item.actorId,
        initials: item.actorInitials,
        avatarUrl: item.actorAvatarUrl,
        title: item.actorName,
        body: `хочет вступить в группу «${item.groupName}»`,
      };
    case 'group-join-accepted':
      return {
        authorId: item.actorId,
        initials: item.actorInitials,
        avatarUrl: item.actorAvatarUrl,
        title: item.actorName,
        body: `принял(а) вашу заявку в группу «${item.groupName}»`,
      };
  }
}

/** Компактный неблокирующий попап — только для отображения, вся логика
 * (навигация, сеть) приходит извне через колбэки (см. `widgets/notification-toaster`).
 *
 * Аватар/имя — отдельный `button` с `stopPropagation` внутри строки-`div`
 * (не `button`, чтобы не вкладывать кнопку в кнопку — невалидный HTML): клик
 * по нему ведёт на профиль автора, клик по остальной строке — туда, куда
 * ведёт сам тост (см. `onClick`, `widgets/notification-toaster`). */
export function NotificationToast({
  item,
  onDismiss,
  onClick,
  onAuthorClick,
  onAccept,
  onDecline,
}: NotificationToastProps) {
  const { authorId, initials, avatarUrl, title, body } = describe(item);

  return (
    <Card as="article" className={styles.toast}>
      <div
        className={styles['toast__content']}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onClick();
        }}
      >
        <button
          type="button"
          className={styles['toast__avatar-trigger']}
          onClick={(event) => {
            event.stopPropagation();
            onAuthorClick?.(authorId);
          }}
        >
          <Avatar initials={initials} src={avatarUrl} size="sm" />
        </button>
        <span className={styles['toast__body']}>
          <button
            type="button"
            className={styles['toast__title-trigger']}
            onClick={(event) => {
              event.stopPropagation();
              onAuthorClick?.(authorId);
            }}
          >
            <span className={styles['toast__title']}>{title}</span>
          </button>
          <span className={styles['toast__text']}>{body}</span>
        </span>
      </div>

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
