'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { FriendshipStatus } from './send-friend-request';

/** Отмена своей исходящей заявки или отклонение чужой входящей — на backend
 * это одна и та же операция (см. FriendsService.respondToRequest). */
export async function respondToFriendRequest(userId: string): Promise<FriendshipStatus> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<FriendshipStatus>(`/friends/requests/${userId}`, {
    method: 'DELETE',
    token,
  });
}
