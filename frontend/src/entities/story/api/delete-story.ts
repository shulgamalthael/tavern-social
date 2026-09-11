'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

/** Удалить можно только собственную историю — проверка на backend
 * (`StoriesService.remove`). */
export async function deleteStory(storyId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  await backendFetch<void>(`/stories/${storyId}`, { method: 'DELETE', token });
}
