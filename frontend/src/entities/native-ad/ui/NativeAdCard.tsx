'use client';

import { useEffect, useRef } from 'react';
import { recordNativeAdClick, recordNativeAdImpression } from '../api/record-native-ad-event';
import type { NativeAdFeedItem } from '../model/types';
import { cn } from '@/shared/lib/cn';
import { Card } from '@/shared/ui/Card';
import { MegaphoneIcon } from '@/shared/ui/icons';
import styles from './NativeAdCard.module.scss';

export interface NativeAdCardProps {
  ad: NativeAdFeedItem;
}

/**
 * "Sponsored/Partner"-карточка в ленте (корневой план фичи §1) — намеренно
 * НЕ баннер: та же визуальная плотность и та же `Card`-обвязка, что у
 * `PostCard` рядом, только с явным лейблом-разделителем сверху (`Партнёрский
 * материал`), чтобы отличие "это реклама" было всегда честным и заметным, не
 * маскировкой под обычный пост. Четыре стиля (`style`) — контент один и тот
 * же (заголовок/текст/картинка или видео/CTA), разница только в композиции
 * ниже; adaptive-контейнер (padding-bottom % от ширины, тот же приём, что
 * `AdCreativePreview`) — макет никогда не ломается от неизвестного
 * соотношения сторон загруженной картинки/видео.
 */
export function NativeAdCard({ ad }: NativeAdCardProps) {
  const hasRecordedImpression = useRef(false);

  useEffect(() => {
    if (hasRecordedImpression.current) return;
    hasRecordedImpression.current = true;
    void recordNativeAdImpression(ad.assignmentId);
  }, [ad.assignmentId]);

  function handleClick() {
    void recordNativeAdClick(ad.assignmentId);
  }

  return (
    <Card as="section" className={styles.ad}>
      <div className={styles['ad__sponsor']}>
        <MegaphoneIcon />
        <span>Партнёрский материал · {ad.sponsorName}</span>
      </div>

      <a
        href={ad.targetUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={handleClick}
        className={cn(styles['ad__body'], styles[`ad__body--${ad.style}`])}
      >
        {ad.style === 'video' && ad.videoUrl ? (
          <div className={cn(styles['ad__media'], styles[`ad__media--${ad.style}`])}>
            <video
              src={ad.videoUrl}
              className={styles['ad__media-el']}
              muted
              loop
              autoPlay
              playsInline
            />
          </div>
        ) : ad.imageUrl ? (
          <div className={cn(styles['ad__media'], styles[`ad__media--${ad.style}`])}>
            {/* eslint-disable-next-line @next/next/no-img-element -- превью произвольного загруженного URL рекламодателя */}
            <img src={ad.imageUrl} alt="" className={styles['ad__media-el']} />
          </div>
        ) : null}

        <div className={styles['ad__content']}>
          <p className={cn(styles['ad__headline'], styles[`ad__headline--${ad.style}`])}>
            {ad.headline}
          </p>
          {ad.bodyText && <p className={styles['ad__text']}>{ad.bodyText}</p>}
          {ad.ctaLabel && (
            <span className={cn(styles['ad__cta'], styles[`ad__cta--${ad.style}`])}>
              {ad.ctaLabel}
            </span>
          )}
        </div>
      </a>
    </Card>
  );
}
