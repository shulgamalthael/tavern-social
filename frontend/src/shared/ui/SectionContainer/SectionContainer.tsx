import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';
import styles from './SectionContainer.module.scss';

export interface SectionContainerProps extends HTMLAttributes<HTMLElement> {
  /** Узкая колонка — для одноколоночных разделов вроде настроек. */
  narrow?: boolean;
}

/** Базовый `<main>`-контейнер раздела: общая ширина и отступы для всех виджетов-страниц. */
export function SectionContainer({ narrow, className, ...rest }: SectionContainerProps) {
  return (
    <main
      className={cn(
        styles['section-container'],
        narrow && styles['section-container--narrow'],
        className,
      )}
      {...rest}
    />
  );
}
