/** Счётчики событий бизнеса — см. комментарий модели `AnalyticsEvent` в
 * backend schema.prisma. Ключи `last7Days`/`allTime` — `'page_view'`/
 * `'order_created'`/`'appointment_created'`/`'form_submission'` сегодня, но
 * не типизированы жёстко (см. `AnalyticsEventType` на backend, свободная
 * строка) — единственный сегодняшний потребитель (`OverviewSection`) читает
 * только `page_view`, остальные ключи просто присутствуют в ответе на
 * будущее, без специального типа под каждый.
 */
export interface AnalyticsSummary {
  last7Days: Record<string, number>;
  allTime: Record<string, number>;
}
