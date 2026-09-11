'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

/** Fire-and-forget учёт вставки каталожного виджета (AI_PLATFORM_ROADMAP.md
 * §74) — единственное доказательство для GC (`CustomWidgetCatalogGcService`),
 * что виджет реально пригодился кому-то, кроме автора. Вызывающий
 * (`ComponentLibraryPanel`) не ждёт результата и не показывает ошибку — это
 * счётчик, не критичное для самой вставки действие (та уже произошла
 * локально, в черновике сайта, к моменту этого вызова). */
export async function recordWidgetCatalogInsert(
  widgetId: string,
  businessId: string,
): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;

  await backendFetch<void>(`/widget-catalog/${widgetId}/record-insert`, {
    method: 'POST',
    token,
    body: { businessId },
  });
}
