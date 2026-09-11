'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { getCreatorEligibility, getMyCreatorProfile, type CreatorStatus } from '@/entities/creator';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import profileStyles from './ProfileWidget.module.scss';
import styles from './CreatorPromoCard.module.scss';

/**
 * "Стать блогером" (AI_PLATFORM_ROADMAP.md §79, Creator Monetization Phase
 * 1) — только на СВОЁМ профиле (см. `ProfileWidget.tsx`, рендерится рядом с
 * `ProfileFriendsCard`, тем же принципом owned-контента). Три состояния:
 * заблокировано с прогрессом (мало друзей), доступно (CTA на онбординг),
 * уже Creator (ссылка в Creator Studio, с честным статусом — верификация
 * ожидается/отклонена/приостановлена, не всегда сразу "активен").
 */
export function CreatorPromoCard() {
  const fetcher = useCallback(
    () => Promise.all([getCreatorEligibility(), getMyCreatorProfile()]),
    [],
  );
  const { status, data } = useAsyncData(fetcher);

  if (status !== 'success' || !data) return null;
  const [eligibility, profile] = data;

  return (
    <Card>
      <h2 className={profileStyles['profile__card-title']}>Монетизация</h2>

      {profile ? (
        <div className={styles.promo}>
          <p className={styles.promo__status}>{describeStatus(profile.status)}</p>
          {profile.status === 'rejected' && profile.rejectionReason && (
            <p className={styles.promo__hint}>{profile.rejectionReason}</p>
          )}
          <Link href={profile.status === 'active' ? '/creator/studio' : '/creator/onboarding'}>
            <Button variant="outline" fullWidth>
              {profile.status === 'active' ? 'Открыть Creator Studio' : 'Продолжить'}
            </Button>
          </Link>
        </div>
      ) : eligibility.eligible ? (
        <div className={styles.promo}>
          <p className={styles.promo__hint}>
            Мы сами находим бренды, которым интересна ваша аудитория — вам не нужно искать
            рекламодателей самостоятельно.
          </p>
          <Link href="/creator/onboarding">
            <Button fullWidth>Стать блогером</Button>
          </Link>
        </div>
      ) : (
        <div className={styles.promo}>
          <p className={styles.promo__locked}>
            🔒 Creator доступен от {eligibility.requiredSubscribers.toLocaleString('ru-RU')}{' '}
            подписчиков
          </p>
          <div className={styles.promo__progress}>
            <div
              className={styles['promo__progress-bar']}
              style={{
                width: `${Math.min(100, (eligibility.subscriberCount / eligibility.requiredSubscribers) * 100)}%`,
              }}
            />
          </div>
          <p className={styles.promo__hint}>
            {eligibility.subscriberCount.toLocaleString('ru-RU')} /{' '}
            {eligibility.requiredSubscribers.toLocaleString('ru-RU')} подписчиков
          </p>
        </div>
      )}
    </Card>
  );
}

function describeStatus(status: CreatorStatus): string {
  switch (status) {
    case 'verification_pending':
      return 'Верификация личности в процессе — обычно занимает несколько минут.';
    case 'verified':
    case 'active':
      return 'Вы Creator — монетизация подключена.';
    case 'rejected':
      return 'Верификация не пройдена.';
    case 'suspended':
      return 'Статус Creator приостановлен администратором.';
  }
}
