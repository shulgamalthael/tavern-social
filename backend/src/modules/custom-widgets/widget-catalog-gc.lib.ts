/** Один расшаренный виджет — только то, что нужно решению GC, не весь
 * `CustomWidget` (тот же принцип, что `UploadFileEntry` у upload-retention:
 * чистая функция получает узкий, уже вычисленный снимок, не сырую строку
 * БД). */
export interface CatalogWidgetSnapshot {
  id: string;
  sharedAt: Date;
  catalogInsertCount: number;
}

/**
 * Чистая функция — какие расшаренные виджеты пора убрать из каталога
 * (AI_PLATFORM_ROADMAP.md §74): старше `gracePeriodMs` С МОМЕНТА
 * попадания в каталог (`sharedAt`) И всё ещё меньше `minInserts`
 * подтверждённых вставок ДРУГИМИ бизнесами (`catalogInsertCount`, см.
 * `CustomWidgetsService.recordCatalogInsert`). "Убрать из каталога" —
 * `isShared: false`, не удаление строки: виджет остаётся приватным
 * виджетом своего изначального автора как ни в чём не бывало.
 *
 * Не трогает Prisma/время сама — та же причина, что и у
 * `selectOrphanedUploadUrls` (`uploads-retention.lib.ts`): юнит-тестируема
 * без мока БД, реальный ввод-вывод — только в `CustomWidgetCatalogGcService`.
 */
export function selectWidgetsToDemote(
  widgets: readonly CatalogWidgetSnapshot[],
  now: Date,
  gracePeriodMs: number,
  minInserts: number,
): string[] {
  const cutoff = now.getTime() - gracePeriodMs;
  return widgets
    .filter(
      (widget) => widget.sharedAt.getTime() < cutoff && widget.catalogInsertCount < minInserts,
    )
    .map((widget) => widget.id);
}
