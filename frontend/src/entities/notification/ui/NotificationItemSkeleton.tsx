import { Skeleton } from '@/shared/ui/Skeleton';
import styles from './NotificationItem.module.scss';

/** Заглушка `NotificationItem` на время загрузки ленты уведомлений. */
export function NotificationItemSkeleton() {
  return (
    <div className={styles.item}>
      <Skeleton width={38} height={38} radius="50%" />
      <span className={styles['item__body']}>
        <Skeleton width="90%" height={13.5} />
        <Skeleton width="60%" height={13.5} />
        <Skeleton width={70} height={12} />
      </span>
    </div>
  );
}
