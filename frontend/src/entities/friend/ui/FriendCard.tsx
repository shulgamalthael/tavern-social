import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Tag } from '@/shared/ui/Tag';
import type { Friend } from '../model/types';
import styles from './FriendCard.module.scss';

export interface FriendCardProps {
  friend: Friend;
  onMessage?: () => void;
}

export function FriendCard({ friend, onMessage }: FriendCardProps) {
  return (
    <Card as="article" className={styles.friend}>
      <Avatar initials={friend.initials} size="lg" online={friend.here} />
      <div className={styles.friend__body}>
        <div className={styles.friend__top}>
          <span className={styles.friend__name}>{friend.name}</span>
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
          <Button variant="outline">Позвать за стол</Button>
        </div>
      </div>
    </Card>
  );
}
