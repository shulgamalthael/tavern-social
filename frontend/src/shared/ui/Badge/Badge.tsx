import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import styles from './Badge.module.scss';

export type BadgeVariant = 'accent' | 'soft';

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'accent', className }: BadgeProps) {
  return (
    <span className={cn(styles.badge, styles[`badge--${variant}`], className)}>{children}</span>
  );
}
