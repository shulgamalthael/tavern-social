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
}

export function FriendRequestCard({
  request,
  variant,
  onAccept,
  onRemove,
}: FriendRequestCardProps) {
  return (
    <Card as="article" className={styles.request}>
      <Avatar initials={request.initials} />
      <div className={styles.request__body}>
        <div className={styles.request__top}>
          <span className={styles.request__name}>{request.name}</span>
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
