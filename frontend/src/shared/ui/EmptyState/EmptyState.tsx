import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import styles from './EmptyState.module.scss';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Единое пустое состояние: заголовок + пояснение + опциональный CTA.
 * Используется только когда данные точно получены и их точно нет —
 * не путайте с loading/error (см. `Loader`, `ErrorState`).
 */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(styles['empty-state'], className)}>
      <p className={styles['empty-state__title']}>{title}</p>
      {description && <p className={styles['empty-state__description']}>{description}</p>}
      {action && <div className={styles['empty-state__action']}>{action}</div>}
    </div>
  );
}
