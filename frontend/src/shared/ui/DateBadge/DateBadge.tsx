import { cn } from '@/shared/lib/cn';
import styles from './DateBadge.module.scss';

export interface DateBadgeProps {
  day: string;
  month: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** День + месяц сбора/события — переиспользуется в ленте и в карточке поста. */
export function DateBadge({ day, month, size = 'md', className }: DateBadgeProps) {
  return (
    <div className={cn(styles['date-badge'], className)}>
      <span
        className={cn(styles['date-badge__day'], size === 'sm' && styles['date-badge__day--sm'])}
      >
        {day}
      </span>
      <span className={styles['date-badge__month']}>{month}</span>
    </div>
  );
}
