'use server';

import { BackendError, backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AiChatResult } from '../model/types';

/** `POST /businesses/:businessId/ai/chat` (`AiController`, см.
 * `AI_PLATFORM_ROADMAP.md` §6) — синхронный запрос-ответ, без стриминга
 * (стриминг — фаза AI-3). Может занимать несколько секунд (реальный вызов
 * LLM-провайдера, возможно с циклом инструментов внутри) — вызывающий код
 * обязан сам показать состояние ожидания, `backendFetch` не таймаутит сам.
 *
 * `BackendError` ловится и разворачивается в обычный `Error` ЗДЕСЬ, на
 * сервере — тот же приём, что уже есть в `features/auth/api/actions.ts`
 * (`error instanceof BackendError ? error.message : ...`). `backend-
 * client.ts` начинается с `import 'server-only'`, поэтому клиентский код
 * (`AiChatPanel.tsx`) не должен импортировать из него вообще ничего, даже
 * класс `BackendError` для `instanceof` — Next.js это отдельно запрещает
 * (сборка падает: «'server-only' cannot be imported from a Client
 * Component module»), обнаружено реальным `next build`, не только typecheck. */
export async function sendAiChatMessage(
  businessId: string,
  message: string,
): Promise<AiChatResult> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  try {
    return await backendFetch<AiChatResult>(`/businesses/${businessId}/ai/chat`, {
      method: 'POST',
      token,
      body: { message },
    });
  } catch (error) {
    if (error instanceof BackendError && error.status === 503) {
      throw new Error('AI-ассистент пока не настроен на этом сервере.');
    }
    throw error instanceof BackendError ? new Error(error.message) : error;
  }
}
