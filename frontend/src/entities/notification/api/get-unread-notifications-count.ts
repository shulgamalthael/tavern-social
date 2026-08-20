'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

export async function getUnreadNotificationsCount(): Promise<number> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const { count } = await backendFetch<{ count: number }>('/notifications/unread-count', {
    token,
  });
  return count;
}
