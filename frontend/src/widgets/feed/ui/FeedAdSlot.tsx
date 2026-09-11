'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { recordFeedAdClick, recordFeedAdImpression, type SelectedAd } from '@/entities/advertising';
import { cn } from '@/shared/lib/cn';
import { Card } from '@/shared/ui/Card';
import { MegaphoneIcon } from '@/shared/ui/icons';
import styles from './FeedAdSlot.module.scss';

export interface FeedAdSlotProps {
  /** Реальный оплаченный креатив под этот слот (см. `FeedWidget`'s
   * `selectFeedAds` — уже отобран по ставке `AdEngineService`, здесь только
   * отрисовка + учёт показа/клика). `null`/`undefined` — на это место
   * сейчас нет ни одной подходящей активной кампании, честный "нет рекламы
   * сейчас", не ошибка. */
  ad?: SelectedAd | null;
  /** `compact` — вторая карточка-приглашение в паре (левый сайдбар), без
   * описания и пониже, чтобы пара не спорила по весу с «Обсуждают в зале»
   * под ней. Не влияет на отрисовку реального `ad` — оплаченный креатив
   * всегда показывается полностью. */
  size?: 'default' | 'compact';
  className?: string;
}

/**
 * Слот в сайдбаре ленты. Реальную доставку делает `AdEngineService.
 * selectCreativesForFeed` (`AdPlacement.feed_sidebar`) — тот же самый
 * движок и та же ставка/бюджет/модерация, что и у баннеров на сайтах
 * бизнесов (`entities/advertising`), просто без паблишера-сайта (см. её
 * комментарий). Пока на это место нет подходящей активной кампании (или
 * запрос ещё не вернулся), слот честно ведёт себя как приглашение купить
 * размещение (см. `app/advertise`), а не имитирует чужое объявление
 * захардкоженной заглушкой — `entities/native-ad` (`in_feed`) для другого
 * места (внутри самой ленты постов) этой подмены тоже не делает.
 */
export function FeedAdSlot({ ad, size = 'default', className }: FeedAdSlotProps) {
  const impressionFiredForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ad || impressionFiredForRef.current === ad.creativeId) return;
    impressionFiredForRef.current = ad.creativeId;
    void recordFeedAdImpression({ campaignId: ad.campaignId, creativeId: ad.creativeId });
  }, [ad]);

  if (ad) {
    return (
      <Card className={cn(styles.slot, className)}>
        <span className={styles['slot__eyebrow']}>
          <MegaphoneIcon />
          Реклама
        </span>
        <a
          href={ad.targetUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className={styles['slot__creative']}
          onClick={() =>
            void recordFeedAdClick({ campaignId: ad.campaignId, creativeId: ad.creativeId })
          }
        >
          {ad.imageUrl && (
            <span className={styles['slot__creative-media']}>
              {/* eslint-disable-next-line @next/next/no-img-element -- креатив рекламодателя, произвольный домен медиа-хранилища */}
              <img src={ad.imageUrl} alt="" className={styles['slot__creative-image']} />
            </span>
          )}
          <p className={styles['slot__title']}>{ad.headline}</p>
          {ad.description && <p className={styles['slot__description']}>{ad.description}</p>}
          {ad.ctaLabel && <span className={styles['slot__cta']}>{ad.ctaLabel}</span>}
        </a>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        styles.slot,
        styles['slot--invitation'],
        size === 'compact' && styles['slot--compact'],
        className,
      )}
    >
      <span className={styles['slot__eyebrow']}>
        <MegaphoneIcon />
        Реклама
      </span>
      <p className={styles['slot__title']}>Место для вашей рекламы</p>
      {size === 'default' && (
        <p className={styles['slot__description']}>
          Здесь его увидят гости зала — настройте показ самостоятельно, без менеджера.
        </p>
      )}
      <Link href="/advertise" className={styles['slot__cta']}>
        Разместить рекламу
      </Link>
    </Card>
  );
}
