'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { FriendshipStatus } from './send-friend-request';

export async function acceptFriendRequest(senderId: string): Promise<FriendshipStatus> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<FriendshipStatus>(`/friends/requests/${senderId}/accept`, {
    method: 'POST',
    token,
  });
}
