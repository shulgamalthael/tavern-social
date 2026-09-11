'use client';

import Link from 'next/link';
import type { Business } from '@/entities/business';
import { Avatar } from '@/shared/ui/Avatar';
import { BackIcon } from '@/shared/ui/icons';
import { AdvertisingSection } from './AdvertisingSection';
import styles from './BusinessDashboardWidget.module.scss';

export interface AdvertiserDashboardWidgetProps {
  business: Business;
}

/**
 * Урезанный дашборд для внешнего рекламодателя (`Business.isAdvertiserOnly`,
 * AI_PLATFORM_ROADMAP.md §71) — рендерится вместо полного
 * `BusinessDashboardWidget` (см. её вызов из того же файла). Ни вкладок, ни
 * ссылок на Конструктор/Настройки/сайт: у такого бизнеса сайт навсегда
 * остаётся пустым черновиком, показывать эти ссылки означало бы вести в
 * никуда. "Назад" ведёт в `/businesses` (список), а не на `/business/[id]`
 * (соцсеть-профиль бизнеса) — профиля, который имело бы смысл смотреть, у
 * рекламодателя нет. Переиспользует стили `BusinessDashboardWidget.module.
 * scss` (шапка/контент) — тот же визуальный язык, без своего файла ради
 * нескольких классов.
 */
export function AdvertiserDashboardWidget({ business }: AdvertiserDashboardWidgetProps) {
  return (
    <div className={styles.root}>
      <header className={styles.bar}>
        <Link href="/businesses" className={styles.back} aria-label="Назад к списку">
          <BackIcon />
        </Link>
        <Avatar
          size="sm"
          initials={business.name.slice(0, 2).toUpperCase()}
          src={business.logoUrl}
        />
        <div className={styles.bar__titles}>
          <h1 className={styles.bar__name}>{business.name}</h1>
          <span className={styles.badge}>Рекламодатель</span>
        </div>
      </header>

      <div className={styles.content}>
        <AdvertisingSection business={business} />
      </div>
    </div>
  );
}
