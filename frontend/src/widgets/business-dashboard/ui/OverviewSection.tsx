'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { getAnalyticsSummary } from '@/entities/analytics';
import type { Business } from '@/entities/business';
import { getBillingStatus, type PlanTier } from '@/entities/subscription';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import {
  CalendarIcon,
  CheckIcon,
  EditIcon,
  EyeIcon,
  FileIcon,
  GlobeIcon,
  MailIcon,
  ShoppingBagIcon,
  StarIcon,
} from '@/shared/ui/icons';
import styles from './OverviewSection.module.scss';

const PLAN_TIER_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  starter: 'Starter',
  business: 'Business',
  scale: 'Scale',
  enterprise: 'Enterprise',
};

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
 * Аналитика (ROADMAP.md §3.8/§8 Phase 10, расширено в Phase 10 continued) —
 * все четыре типа события, которые сегодня вообще пишет `AnalyticsService.
 * record()` (`page_view`/`order_created`/`appointment_created`/
 * `form_submission`), не только просмотры страниц: `AnalyticsSummaryDto`
 * уже считал их все с самого начала, просто `OverviewSection` раньше читал
 * только `page_view`. Полноценный график/тренд по дням сознательно НЕ
 * добавлен здесь — тот остаётся отложенным в §6 корневого плана до
 * появления реального объёма событий, на который имело бы смысл смотреть
 * как на тренд; показ уже посчитанных сумм по всем типам — не то же самое
 * решение, что рисовать график из одной точки данных на бизнес. Заказы/
 * записи показываются только при включённой соответствующей капабилити (то
 * же, что делает остальной Dashboard) — заявки форм показываются всегда, у
 * них нет капабилити-гейта нигде в проекте (см. `FormSubmissionsService`).
 *
 * «Тариф» (Payment Plans v1) — то самое место, где owner видит текущий план
 * и попадает на его историю/апгрейд (`/business/[id]/plan`), не только в
 * момент первого гейта после создания бизнеса — та же страница работает и
 * как self-serve апгрейд, см. `PlanSelectorWidget`'s комментарий.
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
  const last7Days = analytics.data?.last7Days;
  const hasCommerce = business.capabilities.includes('commerce');
  const hasBooking = business.capabilities.includes('booking');

  const billingFetcher = useCallback(() => getBillingStatus(business.id), [business.id]);
  const billing = useAsyncData(billingFetcher);
  const planLabel = billing.data?.tier ? PLAN_TIER_LABELS[billing.data.tier] : '—';

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
              {analytics.status === 'success' ? (last7Days?.page_view ?? 0) : '—'}
            </p>
          </div>
        </div>

        {hasCommerce && (
          <div className={styles.stat}>
            <span className={styles.stat__icon}>
              <ShoppingBagIcon />
            </span>
            <div>
              <p className={styles.stat__label}>Заказов за 7 дней</p>
              <p className={styles.stat__value}>
                {analytics.status === 'success' ? (last7Days?.order_created ?? 0) : '—'}
              </p>
            </div>
          </div>
        )}

        {hasBooking && (
          <div className={styles.stat}>
            <span className={styles.stat__icon}>
              <CalendarIcon />
            </span>
            <div>
              <p className={styles.stat__label}>Записей за 7 дней</p>
              <p className={styles.stat__value}>
                {analytics.status === 'success' ? (last7Days?.appointment_created ?? 0) : '—'}
              </p>
            </div>
          </div>
        )}

        <Link href={`/business/${business.id}/plan`} className={styles.stat}>
          <span className={styles.stat__icon}>
            <StarIcon />
          </span>
          <div>
            <p className={styles.stat__label}>Тариф</p>
            <p className={styles.stat__value}>{billing.status === 'success' ? planLabel : '—'}</p>
          </div>
        </Link>

        <div className={styles.stat}>
          <span className={styles.stat__icon}>
            <MailIcon />
          </span>
          <div>
            <p className={styles.stat__label}>Заявок с форм за 7 дней</p>
            <p className={styles.stat__value}>
              {analytics.status === 'success' ? (last7Days?.form_submission ?? 0) : '—'}
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
