'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/cn';
import { BackIcon, CloseIcon } from '@/shared/ui/icons';
import styles from './ImageLightbox.module.scss';

export interface LightboxImage {
  id: string;
  url: string;
}

export interface ImageLightboxProps {
  images: LightboxImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Слот под изображением — для реакций/комментариев к конкретному фото
   * (см. `widgets/profile/ui/GalleryLightbox`). Сам примитив ничего не знает
   * о том, что в нём рендерится — остаётся без бизнес-логики. */
  footer?: ReactNode;
}

/**
 * Полноэкранный просмотр с каруселью — переиспользуемый примитив без
 * бизнес-логики (список изображений передаётся снаружи), поэтому в
 * `shared/ui`, а не в `entities/gallery`. Клавиатура (Esc/стрелки) наравне с
 * кликами — просмотр открывается по клику на превью в галерее.
 *
 * Рендерится через портал в `document.body` — `SectionContainer` (общий
 * контейнер разделов) задаёт `position: relative; z-index: 1`, что создаёт
 * свой stacking context: без портала `position: fixed` здесь всё равно
 * красится внутри этого контекста и оказывается ПОД плавающим доком
 * навигации (`z-index: 40`), несмотря на собственный больший z-index.
 */
export function ImageLightbox({
  images,
  index,
  onIndexChange,
  onClose,
  footer,
}: ImageLightboxProps) {
  const canPrev = index > 0;
  const canNext = index < images.length - 1;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && canPrev) onIndexChange(index - 1);
      if (event.key === 'ArrowRight' && canNext) onIndexChange(index + 1);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [index, canPrev, canNext, onIndexChange, onClose]);

  const image = images[index];
  if (!image) return null;

  return createPortal(
    <div
      className={styles.lightbox}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фото"
      onClick={onClose}
    >
      <button
        type="button"
        className={styles['lightbox__close']}
        onClick={onClose}
        aria-label="Закрыть просмотр"
      >
        <CloseIcon />
      </button>

      {canPrev && (
        <button
          type="button"
          className={cn(styles['lightbox__nav'], styles['lightbox__nav--prev'])}
          onClick={(event) => {
            event.stopPropagation();
            onIndexChange(index - 1);
          }}
          aria-label="Предыдущее фото"
        >
          <BackIcon />
        </button>
      )}

      <div className={styles['lightbox__stage']} onClick={(event) => event.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element -- произвольные загруженные изображения галереи, полноэкранный просмотр */}
        <img src={image.url} alt="" className={styles['lightbox__image']} />

        {images.length > 1 && (
          <span className={styles['lightbox__counter']}>
            {index + 1} / {images.length}
          </span>
        )}

        {footer && <div className={styles['lightbox__footer']}>{footer}</div>}
      </div>

      {canNext && (
        <button
          type="button"
          className={cn(styles['lightbox__nav'], styles['lightbox__nav--next'])}
          onClick={(event) => {
            event.stopPropagation();
            onIndexChange(index + 1);
          }}
          aria-label="Следующее фото"
        >
          <BackIcon />
        </button>
      )}
    </div>,
    document.body,
  );
}
