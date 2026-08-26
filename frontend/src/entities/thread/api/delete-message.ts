'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

/** Удалить можно только своё сообщение (backend это и проверяет) —
 * необратимо, без плейсхолдера «сообщение удалено» (тот же выбор, что и у
 * удаления поста). */
export async function deleteMessage(threadId: string, messageId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');
  await backendFetch(`/threads/${threadId}/messages/${messageId}`, { method: 'DELETE', token });
}
