'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { FollowStatus } from '../model/types';

export async function unfollowUser(userId: string): Promise<FollowStatus> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<FollowStatus>(`/subscriptions/${userId}`, {
    method: 'DELETE',
    token,
  });
}
