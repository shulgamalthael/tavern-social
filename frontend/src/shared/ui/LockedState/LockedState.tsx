import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Card } from '@/shared/ui/Card';
import { LockIcon } from '@/shared/ui/icons';
import styles from './LockedState.module.scss';

export interface LockedStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Контент закрыт настройками приватности (не путать с `EmptyState` — там
 * данных точно нет, здесь они есть, но зритель не вправе их увидеть). Пока
 * единственный сценарий — приватная страница пользователя
 * (`widgets/profile/ui/UserProfileView`, `canViewFullProfile`).
 */
export function LockedState({ title, description, action, className }: LockedStateProps) {
  return (
    <Card className={cn(styles['locked-state'], className)}>
      <LockIcon className={styles['locked-state__icon']} width={28} height={28} />
      <p className={styles['locked-state__title']}>{title}</p>
      {description && <p className={styles['locked-state__description']}>{description}</p>}
      {action && <div className={styles['locked-state__action']}>{action}</div>}
    </Card>
  );
}
