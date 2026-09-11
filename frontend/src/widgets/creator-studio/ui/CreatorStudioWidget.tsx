'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  getCreatorEligibility,
  getMyCreatorProfile,
  type CreatorProfile,
  type CreatorStatus,
} from '@/entities/creator';
import { cn } from '@/shared/lib/cn';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { FriendsIcon, MegaphoneIcon, SettingsIcon, WalletIcon } from '@/shared/ui/icons';
import { CreatorAdvertisingSection } from './CreatorAdvertisingSection';
import { CreatorAudienceSection } from './CreatorAudienceSection';
import { CreatorRevenueSection } from './CreatorRevenueSection';
import { CreatorSettingsSection } from './CreatorSettingsSection';
import styles from './CreatorStudioWidget.module.scss';

type StudioTab = 'revenue' | 'advertising' | 'audience' | 'settings';

const TABS: { id: StudioTab; icon: typeof WalletIcon; label: string }[] = [
  { id: 'revenue', icon: WalletIcon, label: 'Доход' },
  { id: 'advertising', icon: MegaphoneIcon, label: 'Реклама' },
  { id: 'audience', icon: FriendsIcon, label: 'Аудитория' },
  { id: 'settings', icon: SettingsIcon, label: 'Настройки' },
];

/**
 * Creator Studio — панель управления Creator-статусом (Phase 1, см.
 * AI_PLATFORM_ROADMAP.md §79). Доступна только уже `active`-статусу;
 * `verification_pending`/`rejected`/`suspended` видят объяснение вместо
 * вкладок (доход/реклама там осмысленно нечего показывать), а не пустой
 * дашборд или ошибку.
 */
export function CreatorStudioWidget() {
  const [tab, setTab] = useState<StudioTab>('revenue');

  const profileFetcher = useCallback(() => getMyCreatorProfile(), []);
  const profile = useAsyncData(profileFetcher);
  const eligibilityFetcher = useCallback(() => getCreatorEligibility(), []);
  const eligibility = useAsyncData(eligibilityFetcher);

  // `updateCreatorSettings` уже возвращает свежий профиль — берём его отсюда
  // напрямую, а не через `profile.refetch()`: тот на время запроса переводит
  // `profile.status` в `'loading'`, из-за чего весь виджет ниже (см. ранний
  // `return` на `Loader`) размонтировал бы саму `CreatorSettingsSection` и
  // терял сообщение «Настройки сохранены» вместе с ней.
  const [savedProfile, setSavedProfile] = useState<CreatorProfile | null>(null);

  if (profile.status === 'loading' || eligibility.status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем Creator Studio…" />
      </div>
    );
  }

  if (profile.status === 'error' || eligibility.status === 'error') {
    return (
      <div className={styles.status}>
        <ErrorState message={profile.error ?? eligibility.error} onRetry={profile.refetch} />
      </div>
    );
  }

  if (!profile.data) {
    return (
      <div className={styles.status}>
        <EmptyState
          title="Вы ещё не подавали заявку на статус Creator"
          action={
            <Link href="/creator/onboarding">
              <Button>Стать блогером</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const data = savedProfile ?? profile.data;

  if (data.status !== 'active') {
    return (
      <div className={styles.status}>
        <p className={styles.statusMessage}>{describeInactiveStatus(data.status)}</p>
        {data.status === 'rejected' && data.rejectionReason && (
          <p className={styles.statusHint}>{data.rejectionReason}</p>
        )}
        {(data.status === 'verification_pending' || data.status === 'rejected') && (
          <Link href="/creator/onboarding">
            <Button variant="outline">Продолжить верификацию</Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <header className={styles.bar}>
        <h1 className={styles.barTitle}>Creator Studio</h1>
      </header>

      <div className={styles.body}>
        <nav className={styles.nav} aria-label="Разделы Creator Studio">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(styles.navItem, tab === item.id && styles['navItem--active'])}
              onClick={() => setTab(item.id)}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
        </nav>

        <div className={styles.content}>
          {tab === 'revenue' && (
            <CreatorRevenueSection profile={data} onProfileChange={setSavedProfile} />
          )}
          {tab === 'advertising' && <CreatorAdvertisingSection />}
          {tab === 'audience' && eligibility.data && (
            <CreatorAudienceSection profile={data} eligibility={eligibility.data} />
          )}
          {tab === 'settings' && (
            <CreatorSettingsSection profile={data} onSaved={setSavedProfile} />
          )}
        </div>
      </div>
    </div>
  );
}

function describeInactiveStatus(status: Exclude<CreatorStatus, 'active'>): string {
  switch (status) {
    case 'verification_pending':
      return 'Верификация личности в процессе — обычно занимает несколько минут.';
    case 'verified':
      return 'Верификация пройдена, статус Creator скоро активируется.';
    case 'rejected':
      return 'Верификация не пройдена.';
    case 'suspended':
      return 'Статус Creator приостановлен администратором.';
  }
}
