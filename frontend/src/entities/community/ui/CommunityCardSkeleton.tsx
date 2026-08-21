import { Skeleton } from '@/shared/ui/Skeleton';
import styles from './CommunityCard.module.scss';

/** Заглушка `CommunityCard` на время загрузки списка сообществ. */
export function CommunityCardSkeleton() {
  return (
    <article className={styles.community}>
      <Skeleton width="100%" height="108px" radius={0} />
      <div className={styles.community__body}>
        <Skeleton width="60%" height={17} />
        <Skeleton width="90%" height={13} />
        <div className={styles.community__footer}>
          <Skeleton width={100} height={34} radius={9} />
          <Skeleton width={80} height={13} />
        </div>
      </div>
    </article>
  );
}
