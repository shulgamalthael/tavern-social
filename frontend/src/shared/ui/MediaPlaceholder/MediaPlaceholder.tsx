import type { CSSProperties } from 'react';
import { cn } from '@/shared/lib/cn';
import styles from './MediaPlaceholder.module.scss';

export interface MediaPlaceholderProps {
  label: string;
  height?: CSSProperties['height'];
  /** Без рамки и радиуса — для обложек внутри уже скруглённой карточки (overflow: hidden). */
  flush?: boolean;
  className?: string;
}

/** Заглушка на месте изображения/обложки — переиспользуется в посте, карточке сообщества и профиле. */
export function MediaPlaceholder({ label, height, flush, className }: MediaPlaceholderProps) {
  return (
    <div
      className={cn(
        styles['media-placeholder'],
        flush && styles['media-placeholder--flush'],
        className,
      )}
      style={height ? { height } : undefined}
    >
      <span className={styles['media-placeholder__label']}>{label}</span>
    </div>
  );
}
