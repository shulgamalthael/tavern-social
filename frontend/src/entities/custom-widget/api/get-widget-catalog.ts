'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CatalogWidget } from '../model/types';

/** Общий каталог виджетов (AI_PLATFORM_ROADMAP.md §74) — НЕ owner-scoped,
 * один и тот же список для любого залогиненного бизнеса (см. backend
 * `WidgetCatalogController`, отдельный от owner-only `/businesses/:id/
 * widgets`). Заполняется только виджетами, которые AI создал через
 * `create_custom_widget` и которые прошли приёмочную проверку. */
export async function getWidgetCatalog(): Promise<CatalogWidget[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CatalogWidget[]>('/widget-catalog', { token });
}
