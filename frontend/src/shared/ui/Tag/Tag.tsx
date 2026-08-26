import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import styles from './Tag.module.scss';

export interface TagProps {
  children: ReactNode;
  className?: string;
  'aria-hidden'?: boolean;
}

export function Tag({ children, className, 'aria-hidden': ariaHidden }: TagProps) {
  return (
    <span className={cn(styles.tag, className)} aria-hidden={ariaHidden}>
      {children}
    </span>
  );
}
