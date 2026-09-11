/** Свободная строка на backend (см. комментарий модели `AnalyticsEvent` в
 * schema.prisma) — эти четыре значения перечислены здесь только как
 * известный на сегодня набор `record()`-вызовов в проекте, не как enum. */
export const ANALYTICS_EVENT_TYPES = [
  'page_view',
  'order_created',
  'appointment_created',
  'form_submission',
  'ad_impression',
  'ad_click',
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

/** Счётчики за последние 7 дней и за всё время — минимум, достаточный,
 * чтобы `OverviewSection` на frontend показал одну живую цифру («N
 * просмотров за 7 дней»), без полноценного дашборда с графиками/разбивкой
 * по дням (см. комментарий модели `AnalyticsEvent`). */
export interface AnalyticsSummaryDto {
  last7Days: Record<string, number>;
  allTime: Record<string, number>;
}
