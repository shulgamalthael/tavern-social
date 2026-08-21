import { Card } from '@/shared/ui/Card';
import { Skeleton } from '@/shared/ui/Skeleton';
import styles from './PostCard.module.scss';

/**
 * Заглушка карточки поста на время загрузки ленты/стены — тот же макет, что
 * у `PostCard` (переиспользует его классы из `PostCard.module.scss`), просто
 * с мерцающими блоками вместо реального аватара/текста/кнопок.
 */
export function PostCardSkeleton() {
  return (
    <Card as="article" className={styles.post}>
      <div className={styles.post__head}>
        <Skeleton width={38} height={38} radius="50%" />
        <div className={styles.post__head_body}>
          <Skeleton width="35%" height={14} />
          <Skeleton width="22%" height={12} />
        </div>
      </div>

      <div className={styles['post__text-skeleton']}>
        <Skeleton width="100%" height={14} />
        <Skeleton width="78%" height={14} />
      </div>

      <footer className={styles.post__footer}>
        <Skeleton width={108} height={28} radius={8} />
        <Skeleton width={108} height={28} radius={8} />
        <Skeleton width={90} height={28} radius={8} />
        <Skeleton width={108} height={28} radius={8} />
      </footer>
    </Card>
  );
}
