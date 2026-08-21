import { Skeleton } from '@/shared/ui/Skeleton';
import styles from './GroupRow.module.scss';

/** Заглушка `GroupRow` на время загрузки списка групп. */
export function GroupRowSkeleton() {
  return (
    <div className={styles.group}>
      <Skeleton width={40} height={40} radius={10} />
      <div className={styles.group__body}>
        <Skeleton width="45%" height={15} />
        <Skeleton width="65%" height={13} />
      </div>
      <Skeleton width={64} height={11} />
      <Skeleton width={92} height={34} radius={9} />
    </div>
  );
}
