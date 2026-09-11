'use client';

import { getMyNativeAds, NATIVE_AD_CREATIVE_STYLE_LABELS } from '@/entities/native-ad';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import styles from './CreatorAdvertisingSection.module.scss';

/**
 * Реальные назначенные кампании (Creator Monetization Phase 2, см.
 * AI_PLATFORM_ROADMAP.md §80) — nameренно без денежных полей, см. backend
 * `CreatorNativeAdDto`'s комментарий: атрибуция дохода — Phase 4.
 */
export function CreatorAdvertisingSection() {
  const { status, data, error, refetch } = useAsyncData(getMyNativeAds);

  if (status === 'loading') return <Loader label="Загружаем размещения…" />;
  if (status === 'error') return <ErrorState message={error} onRetry={refetch} />;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="Активных рекламных размещений нет"
        description="Мы сами находим рекламодателей, которым интересна ваша аудитория — здесь появятся активные размещения."
      />
    );
  }

  return (
    <div className={styles.list}>
      {data.map((ad) => (
        <Card key={ad.assignmentId} className={styles.item}>
          {ad.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- превью произвольного загруженного URL рекламодателя
            <img src={ad.imageUrl} alt="" className={styles['item__image']} />
          )}
          <div className={styles['item__body']}>
            <span className={styles['item__sponsor']}>{ad.sponsorName}</span>
            <span className={styles['item__headline']}>{ad.headline}</span>
            <span className={styles['item__style']}>
              {NATIVE_AD_CREATIVE_STYLE_LABELS[ad.style]}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
