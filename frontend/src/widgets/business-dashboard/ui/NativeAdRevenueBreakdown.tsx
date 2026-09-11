'use client';

import { useCallback } from 'react';
import { getNativeAdCampaignRevenue } from '@/entities/native-ad';
import { formatMoney } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Loader } from '@/shared/ui/Loader';
import styles from './NativeAdRevenueBreakdown.module.scss';

export interface NativeAdRevenueBreakdownProps {
  businessId: string;
  campaignId: string;
}

/** Прозрачность для рекламодателя (Creator Monetization Phase 4, см.
 * AI_PLATFORM_ROADMAP.md §82) — куда реально уходит списанный бюджет.
 * Только для кампаний, у которых уже могли случиться реальные события
 * (`active`/`paused` — см. вызывающий `NativeAdvertisingSection`), для
 * `draft`/`pending_review`/`rejected` показывать нечего. Молча ничего не
 * рендерит при ошибке/пустом ответе — это вспомогательная прозрачность
 * внутри уже существующей карточки кампании, не отдельный экран, которому
 * нужен свой `ErrorState`. */
export function NativeAdRevenueBreakdown({
  businessId,
  campaignId,
}: NativeAdRevenueBreakdownProps) {
  const fetcher = useCallback(
    () => getNativeAdCampaignRevenue(businessId, campaignId),
    [businessId, campaignId],
  );
  const { status, data } = useAsyncData(fetcher);

  if (status === 'loading') return <Loader label="Считаем распределение…" />;
  if (status === 'error' || !data || data.grossCents === 0) return null;

  return (
    <div className={styles.breakdown}>
      <span className={styles['breakdown__title']}>Куда уходит бюджет</span>
      <div className={styles['breakdown__row']}>
        <span>Creator</span>
        <span>{formatMoney(data.creatorShareCents, data.currency)}</span>
      </div>
      <div className={styles['breakdown__row']}>
        <span>Платформа</span>
        <span>{formatMoney(data.platformFeeCents, data.currency)}</span>
      </div>
      <div className={styles['breakdown__row']}>
        <span>Обработка платежа</span>
        <span>{formatMoney(data.processingFeeCents, data.currency)}</span>
      </div>
    </div>
  );
}
