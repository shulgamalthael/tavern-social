'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { ToolExecutionSummary } from '../model/types';

/** AI-9 (AI_PLATFORM_ROADMAP.md §2.8/§21) — `POST .../ai/confirm/:confirmationId`
 * (`AiController`, владелец-only через `AiOwnershipGuard`, тот же принцип,
 * что и `getAiActivity`). Выполняет РОВНО тот вызов, что модель оставила
 * `pending` (`confirmationId` — id соответствующей строки `AuditLog`), без
 * повторного обращения к LLM. */
export async function confirmToolCall(
  businessId: string,
  confirmationId: string,
): Promise<ToolExecutionSummary> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<ToolExecutionSummary>(
    `/businesses/${businessId}/ai/confirm/${confirmationId}`,
    { method: 'POST', token },
  );
}
