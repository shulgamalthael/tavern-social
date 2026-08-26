import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import styles from './IdBadgeGroup.module.scss';

export interface IdBadgeGroupProps {
  children: ReactNode;
  className?: string;
}

/**
 * Ряд из нескольких `IdBadge` рядом друг с другом — нужен там, где у одной
 * записи одновременно видны два разных id (запись + её автор, см.
 * `PostCard`/`AdminPostsPanel`), чтобы оба сидели вместе одним блоком, а не
 * были разбросаны по разным местам карточки. Сам просто оборачивает в
 * ряд с переносом — раскладка отдельных `IdBadge` не меняется.
 */
export function IdBadgeGroup({ children, className }: IdBadgeGroupProps) {
  return <span className={cn(styles['id-badge-group'], className)}>{children}</span>;
}
