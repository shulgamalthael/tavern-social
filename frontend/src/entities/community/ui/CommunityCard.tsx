import { Button } from '@/shared/ui/Button';
import { MediaPlaceholder } from '@/shared/ui/MediaPlaceholder';
import type { Community } from '../model/types';
import styles from './CommunityCard.module.scss';

export interface CommunityCardProps {
  community: Community;
  isJoined: boolean;
  onToggleJoin: () => void;
}

export function CommunityCard({ community, isJoined, onToggleJoin }: CommunityCardProps) {
  return (
    <article className={styles.community}>
      <MediaPlaceholder label={community.cover} height="108px" flush />
      <div className={styles.community__body}>
        <h2 className={styles.community__name}>{community.name}</h2>
        <p className={styles['community__about']}>{community.about}</p>
        <div className={styles.community__footer}>
          <Button variant={isJoined ? 'primary' : 'outline'} onClick={onToggleJoin}>
            {isJoined ? 'Вы за столом' : 'Подсесть'}
          </Button>
          <span className={styles['community__members']}>{community.members}</span>
        </div>
      </div>
    </article>
  );
}
