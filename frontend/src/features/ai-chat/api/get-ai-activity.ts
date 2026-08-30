'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AiActivityItem } from '../model/types';

/** `GET /businesses/:businessId/ai/activity` (`AiController`, AI-3, см.
 * AI_PLATFORM_ROADMAP.md §10.7) — та же форма, что и `getWebsiteDraft`
 * (владелец-only на backend, `AiOwnershipGuard`). Обычный запрос-ответ, не
 * стриминг: это чтение уже сохранённых записей, а не живой ход диалога. */
export async function getAiActivity(businessId: string): Promise<AiActivityItem[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<AiActivityItem[]>(`/businesses/${businessId}/ai/activity`, { token });
}
