import { Card } from '@/shared/ui/Card';
import { Skeleton } from '@/shared/ui/Skeleton';
import styles from './FriendCard.module.scss';

/** Заглушка `FriendCard` на время загрузки списка друзей — переиспользует
 * его классы из `FriendCard.module.scss`. */
export function FriendCardSkeleton() {
  return (
    <Card as="article" className={styles.friend}>
      <div className={styles.friend__header}>
        <Skeleton width={92} height={92} radius="50%" />
        <Skeleton width={120} height={16} />
        <Skeleton width={90} height={12} />
      </div>
      <Skeleton width="100%" height={13} />
      <Skeleton width="70%" height={13} />
      <div className={styles.friend__facts}>
        <Skeleton width={60} height={11} />
        <Skeleton width={90} height={11} />
      </div>
      <div className={styles.friend__tags}>
        <Skeleton width={54} height={22} radius={999} />
        <Skeleton width={68} height={22} radius={999} />
      </div>
      <div className={styles.friend__actions}>
        <Skeleton width="100%" height={34} radius={9} />
      </div>
    </Card>
  );
}
