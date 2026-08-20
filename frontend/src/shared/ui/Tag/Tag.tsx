import type { ReactNode } from 'react';
import styles from './Tag.module.scss';

export interface TagProps {
  children: ReactNode;
}

export function Tag({ children }: TagProps) {
  return <span className={styles.tag}>{children}</span>;
}
