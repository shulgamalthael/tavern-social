'use client';

import type { AdFormat } from '@/entities/advertising';
import { AD_FORMAT_PREVIEW_CONFIG } from './ad-format-preview-config';
import styles from './AdCreativePreview.module.scss';

export interface AdCreativePreviewProps {
  format: AdFormat;
  headline: string;
  description: string;
  ctaLabel: string;
  imageUrl: string | null;
  videoUrl: string | null;
}

/**
 * Живое превью креатива — реагирует на КАЖДОЕ изменение формы (формат,
 * текст, картинка/видео) сразу, без сохранения. Та же трёхветочная логика
 * рендера, что и у реального `AdSlotRenderer` на публичном сайте (`entities/
 * website/blocks/advertising/index.tsx`) — видео / картинка / только текст —
 * но переписана здесь заново, а не импортирована: `widgets/business-
 * dashboard` и `entities/website` — соседние слайсы одного слоя, кросс-
 * импорт между ними запрещён правилами FSD проекта. Пропорции берутся из
 * `AD_FORMAT_PREVIEW_CONFIG[format]` — тот же источник, что и у кроппера
 * (`AdCreativeMediaField`), поэтому смена формата меняет форму превью и
 * форму кропа согласованно, из одного места.
 */
export function AdCreativePreview({
  format,
  headline,
  description,
  ctaLabel,
  imageUrl,
  videoUrl,
}: AdCreativePreviewProps) {
  const { width, height } = AD_FORMAT_PREVIEW_CONFIG[format];

  return (
    <div
      className={styles.preview}
      // Классический "padding-bottom %" приём вместо `aspect-ratio` —
      // `aspect-ratio` на этом узле надёжно схлопывалось до нулевой высоты
      // внутри `ScrollArea`'s flex-колонки (живой баг, найденный при
      // проверке через `getComputedStyle`: ширина резолвилась верно, высота
      // — нет). Padding-проценты считаются от ширины блока ВСЕГДА, даже для
      // top/bottom, поэтому этот приём не зависит от того, как родитель
      // управляет высотой flex-детей.
      style={{ maxWidth: width, paddingBottom: `${(height / width) * 100}%` }}
    >
      {videoUrl ? (
        <video
          src={videoUrl}
          className={styles['preview__media']}
          muted
          loop
          autoPlay
          playsInline
        />
      ) : imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- превью произвольного загруженного URL
        <img src={imageUrl} alt="" className={styles['preview__media']} />
      ) : (
        <div className={styles['preview__placeholder']} />
      )}

      <div className={styles['preview__body']}>
        <p className={styles['preview__headline']}>{headline || 'Заголовок объявления'}</p>
        {description && <p className={styles['preview__description']}>{description}</p>}
        {ctaLabel && <span className={styles['preview__cta']}>{ctaLabel}</span>}
      </div>
      <span className={styles['preview__sponsored']}>Реклама</span>
    </div>
  );
}
