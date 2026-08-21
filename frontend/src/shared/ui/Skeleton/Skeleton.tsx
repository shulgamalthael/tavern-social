import type { CSSProperties } from 'react';
import { cn } from '@/shared/lib/cn';
import styles from './Skeleton.module.scss';

export interface SkeletonProps {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  radius?: CSSProperties['borderRadius'];
  className?: string;
}

/**
 * Мерцающий прямоугольник-заглушка — строительный блок для skeleton-состояний
 * загрузки страниц/вкладок. Сам ничего не знает о том, что изображает —
 * раскладку и точные размеры задаёт вызывающий компонент (обычно переиспользуя
 * классы из `*.module.scss` того же блока, который он временно подменяет —
 * см. `entities/post/ui/PostCardSkeleton.tsx` как пример).
 */
export function Skeleton({ width, height, radius, className }: SkeletonProps) {
  return (
    <span
      className={cn(styles.skeleton, className)}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}
