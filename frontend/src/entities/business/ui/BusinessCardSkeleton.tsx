import { Card } from '@/shared/ui/Card';
import { Skeleton } from '@/shared/ui/Skeleton';
import styles from './BusinessCard.module.scss';

export function BusinessCardSkeleton() {
  return (
    <Card as="article" className={styles.card}>
      <div className={styles.card__head}>
        <Skeleton width={54} height={54} radius="50%" />
        <div className={styles['card__head-body']}>
          <Skeleton width="70%" height={16} />
          <Skeleton width="45%" height={12} />
        </div>
      </div>
      <Skeleton width="100%" height={13} />
      <Skeleton width="80%" height={13} />
      <div className={styles.card__meta}>
        <Skeleton width={90} height={20} radius={999} />
        <Skeleton width={110} height={12} />
      </div>
      <Skeleton width="100%" height={38} radius={10} />
    </Card>
  );
}
