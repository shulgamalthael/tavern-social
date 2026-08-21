'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/cn';
import styles from './Modal.module.scss';

export interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  /** Заголовок для `aria-label` — модалка не обязана рендерить видимый
   * заголовок сама (см. `PostEditor` — заголовок «Редактировать запись»
   * рисует сам вызывающий контент). */
  label: string;
  className?: string;
}

/**
 * Минимальный доступный диалог — overlay + закрытие по Escape/клику вне
 * карточки. В `shared/ui`, потому что нужен минимум двум местам (модалка
 * редактирования поста, `features/publish-post/ui/PostEditor`, и — по тому
 * же паттерну оверлея, что раньше был локальным в `ImageUploadButton`) —
 * рендерится через портал в `document.body` тем же приёмом, что и
 * `ImageLightbox` (иначе `position: fixed` красится под плавающим доком
 * навигации внутри stacking context `SectionContainer`).
 */
export function Modal({ onClose, children, label, className }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className={styles.modal}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div
        className={cn(styles['modal__card'], className)}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
