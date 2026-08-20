'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

export interface FriendshipStatus {
  isFriend: boolean;
  hasOutgoingRequest: boolean;
  hasIncomingRequest: boolean;
}

export async function sendFriendRequest(userId: string): Promise<FriendshipStatus> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<FriendshipStatus>(`/friends/requests/${userId}`, {
    method: 'POST',
    token,
  });
}
