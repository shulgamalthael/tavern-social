'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { getAnalyticsSummary } from '@/entities/analytics';
import type { Business } from '@/entities/business';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { CheckIcon, EditIcon, EyeIcon, FileIcon, GlobeIcon } from '@/shared/ui/icons';
import styles from './OverviewSection.module.scss';

export interface OverviewSectionProps {
  business: Business;
  pageCount: number | undefined;
  isPublishing: boolean;
  publishError: string | null;
  onPublish: () => void;
}

/**
 * Сводка — то, что раньше нужно было собирать по кусочкам из трёх разных
 * экранов (опубликован ли сайт — видно только на `/business/[id]`, сколько
 * страниц — только открыв билдер). Кнопка «Опубликовать» здесь — не дубль
 * той же кнопки в тулбаре билдера, а быстрый путь «ничего не меняю, просто
 * хочу опубликовать то, что уже есть», не открывая билдер вообще.
 *
 * «Просмотров за 7 дней» (ROADMAP.md §3.8/§8 Phase 10) — единственный
 * сегодняшний потребитель `entities/analytics`: одна цифра, не полноценный
 * дашборд с графиками (тот явно отложен в §6 корневого плана до появления
 * реального объёма событий) — ровно то, что доказывает, что путь `record()`
 * → `summary()` работает end-to-end, не оставляя таблицу событий висеть
 * совсем без потребителя.
 */
export function OverviewSection({
  business,
  pageCount,
  isPublishing,
  publishError,
  onPublish,
}: OverviewSectionProps) {
  const analyticsFetcher = useCallback(() => getAnalyticsSummary(business.id), [business.id]);
  const analytics = useAsyncData(analyticsFetcher);
  const pageViews7d = analytics.data?.last7Days.page_view ?? 0;

  return (
    <div className={styles.root}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.stat__icon}>
            <GlobeIcon />
          </span>
          <div>
            <p className={styles.stat__label}>Статус сайта</p>
            <p className={styles.stat__value}>
              {business.status === 'published' ? 'Опубликован' : 'Ещё не опубликован'}
            </p>
          </div>
        </div>

        <div className={styles.stat}>
          <span className={styles.stat__icon}>
            <FileIcon />
          </span>
          <div>
            <p className={styles.stat__label}>Страниц</p>
            <p className={styles.stat__value}>{pageCount ?? '—'}</p>
          </div>
        </div>

        <div className={styles.stat}>
          <span className={styles.stat__icon}>
            <EyeIcon />
          </span>
          <div>
            <p className={styles.stat__label}>Просмотров за 7 дней</p>
            <p className={styles.stat__value}>
              {analytics.status === 'success' ? pageViews7d : '—'}
            </p>
          </div>
        </div>
      </div>

      {publishError && (
        <p className={styles.error} role="alert">
          {publishError}
        </p>
      )}

      <div className={styles.actions}>
        <Button onClick={onPublish} disabled={isPublishing}>
          <CheckIcon />
          {isPublishing ? 'Публикуем…' : 'Опубликовать сайт'}
        </Button>
        {/* Не `<Button>` внутри `<Link>` — вложенный `<button>` внутри `<a>`
         * невалиден по HTML-разметке, даже если браузеры это прощают. */}
        <Link href={`/business/${business.id}/edit`} className={styles.editLink}>
          <EditIcon />
          Открыть конструктор
        </Link>
      </div>
    </div>
  );
}
