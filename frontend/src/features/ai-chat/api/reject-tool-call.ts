'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

/** AI-9 (AI_PLATFORM_ROADMAP.md §2.8/§21) — `POST .../ai/reject/:confirmationId`
 * (`AiController`) — отклоняет `pending`-вызов без выполнения. */
export async function rejectToolCall(businessId: string, confirmationId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  await backendFetch<void>(`/businesses/${businessId}/ai/reject/${confirmationId}`, {
    method: 'POST',
    token,
  });
}
