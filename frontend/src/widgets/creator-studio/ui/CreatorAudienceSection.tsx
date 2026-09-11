import type { CreatorEligibility, CreatorProfile } from '@/entities/creator';
import { Card } from '@/shared/ui/Card';
import styles from './CreatorAudienceSection.module.scss';

export interface CreatorAudienceSectionProps {
  profile: CreatorProfile;
  eligibility: CreatorEligibility;
}

/**
 * Только реальные, доступные сегодня числа (subscriber count, категории) — без
 * охватов/показов/вовлечённости: та инфраструктура появится в Phase 2/3
 * (см. AI_PLATFORM_ROADMAP.md §79), придумывать её здесь нельзя.
 */
export function CreatorAudienceSection({ profile, eligibility }: CreatorAudienceSectionProps) {
  const primary = profile.categories.find((category) => category.isPrimary);
  const additional = profile.categories.filter((category) => !category.isPrimary);

  return (
    <div className={styles.section}>
      <Card className={styles.card}>
        <span className={styles.metricLabel}>Подписчики</span>
        <span className={styles.metricValue}>
          {eligibility.subscriberCount.toLocaleString('ru-RU')}
        </span>
      </Card>

      <Card className={styles.card}>
        <h2 className={styles.title}>Категории</h2>
        {primary && (
          <div className={styles.categoryRow}>
            <span className={styles.categoryBadge}>Основная</span>
            {primary.label}
          </div>
        )}
        {additional.map((category) => (
          <div key={category.id} className={styles.categoryRow}>
            <span className={styles.categoryBadgeSoft}>Доп.</span>
            {category.label}
          </div>
        ))}
      </Card>
    </div>
  );
}
