import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Tag } from '@/shared/ui/Tag';
import type { Friend } from '../model/types';
import styles from './FriendCard.module.scss';

export interface FriendCardProps {
  friend: Friend;
  onMessage?: () => void;
  /** Клик по аватару/имени — переход на страницу друга, отдельно от
   * остальных действий карточки (см. AGENTS.md, клики по автору). */
  onAuthorClick?: (friendId: string) => void;
  /** Разрыв дружбы — показывается только там, где вызывающий явно передал
   * колбэк (см. `widgets/friends/ui/FriendsWidget`). */
  onRemove?: () => void;
}

export function FriendCard({ friend, onMessage, onAuthorClick, onRemove }: FriendCardProps) {
  return (
    <Card as="article" className={styles.friend}>
      <button
        type="button"
        className={styles['friend__avatar-trigger']}
        onClick={() => onAuthorClick?.(friend.id)}
      >
        <Avatar initials={friend.initials} src={friend.avatarUrl} size="lg" online={friend.here} />
      </button>
      <div className={styles.friend__body}>
        <div className={styles.friend__top}>
          <button
            type="button"
            className={styles['friend__name-trigger']}
            onClick={() => onAuthorClick?.(friend.id)}
          >
            <span className={styles.friend__name}>{friend.name}</span>
          </button>
          <span className={styles['friend__meta']}>{friend.note}</span>
          <span className={styles.friend__status}>{friend.status}</span>
        </div>
        <p className={styles.friend__about}>{friend.about}</p>
        <div className={styles.friend__facts}>
          <span>{friend.city}</span>
          <span>{friend.mutual}</span>
          <span>{friend.since}</span>
        </div>
        <div className={styles.friend__tags}>
          {friend.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
        <div className={styles.friend__actions}>
          <Button variant="soft" onClick={onMessage}>
            Написать
          </Button>
          {onRemove && (
            <Button variant="outline" onClick={onRemove}>
              Удалить из друзей
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
