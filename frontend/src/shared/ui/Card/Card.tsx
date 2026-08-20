import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';
import styles from './Card.module.scss';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article';
}

export function Card({ as: Component = 'section', className, ...rest }: CardProps) {
  return <Component className={cn(styles.card, className)} {...rest} />;
}
