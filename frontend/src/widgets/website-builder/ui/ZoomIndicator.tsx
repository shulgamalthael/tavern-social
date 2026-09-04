'use client';

import { cn } from '@/shared/lib/cn';
import styles from './ZoomIndicator.module.scss';

export interface ZoomIndicatorProps {
  /** Во сколько раз рамка уменьшена, чтобы поместиться целиком (1 — не
   * рендерится вовсе, см. вызывающих `Canvas.tsx`/`PreviewModal.tsx`). */
  fitZoom: number;
  isFitted: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * Плавающая пилюля поверх холста/превью — показывает, что рамка сейчас
 * уменьшена, и даёт быстро переключиться между «по размеру» (видно всю
 * раскладку целиком, уменьшенную) и «100%» (реальный масштаб, со скроллом).
 * Рендерится вызывающей стороной только когда `fitZoom < 1` — на своём
 * вьюпорте (мобильный редактор + мобильный вьюпорт) масштабировать нечего,
 * лишний контрол только шумел бы.
 */
export function ZoomIndicator({ fitZoom, isFitted, onToggle, className }: ZoomIndicatorProps) {
  const percent = Math.round((isFitted ? fitZoom : 1) * 100);

  return (
    <button
      type="button"
      className={cn(styles.pill, className)}
      onClick={onToggle}
      title={isFitted ? 'Показать в реальном размере (100%)' : 'Уместить целиком'}
    >
      <span className={styles.pill__value}>{percent}%</span>
      <span className={styles.pill__hint}>{isFitted ? 'по размеру' : 'реальный размер'}</span>
    </button>
  );
}
