import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import type { FriendRequestPreview } from '../model/types';
import styles from './FriendRequestCard.module.scss';

export interface FriendRequestCardProps {
  request: FriendRequestPreview;
  /** `incoming` — можно принять/отклонить, `outgoing` — только отменить. */
  variant: 'incoming' | 'outgoing';
  onAccept?: () => void;
  onRemove?: () => void;
  /** Клик по аватару/имени — переход на профиль отправителя/получателя
   * заявки, отдельно от принятия/отклонения (см. AGENTS.md, клики по автору). */
  onAuthorClick?: (userId: string) => void;
}

export function FriendRequestCard({
  request,
  variant,
  onAccept,
  onRemove,
  onAuthorClick,
}: FriendRequestCardProps) {
  return (
    <Card as="article" className={styles.request}>
      <button
        type="button"
        className={styles['request__avatar-trigger']}
        onClick={() => onAuthorClick?.(request.id)}
      >
        <Avatar initials={request.initials} src={request.avatarUrl} size="lg" />
      </button>
      <div className={styles.request__body}>
        <div className={styles.request__top}>
          <button
            type="button"
            className={styles['request__name-trigger']}
            onClick={() => onAuthorClick?.(request.id)}
          >
            <span className={styles.request__name}>{request.name}</span>
          </button>
          <span className={styles.request__meta}>{request.tagline}</span>
        </div>
        <span className={styles.request__meta}>
          {variant === 'incoming' ? 'Хочет добавить вас в друзья' : 'Заявка отправлена'} ·{' '}
          {request.sentAt}
        </span>
      </div>
      <div className={styles.request__actions}>
        {variant === 'incoming' && (
          <Button variant="primary" onClick={onAccept}>
            Принять
          </Button>
        )}
        <Button variant="outline" onClick={onRemove}>
          {variant === 'incoming' ? 'Отклонить' : 'Отменить'}
        </Button>
      </div>
    </Card>
  );
}
