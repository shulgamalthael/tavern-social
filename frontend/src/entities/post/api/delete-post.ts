'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

/** Удаление собственной записи (только автор, только не фото галереи — см.
 * PostsService.remove на backend). */
export async function deletePost(postId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  await backendFetch<void>(`/posts/${postId}`, { method: 'DELETE', token });
}
