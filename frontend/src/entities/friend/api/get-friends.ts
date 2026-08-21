'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Friend } from '../model/types';
import { mapFriend, type FriendResponse } from './map-friend';

interface FriendsPageResponse {
  items: FriendResponse[];
  nextCursor: string | null;
}

export async function getFriends(
  cursor?: string | null,
): Promise<{ friends: Friend[]; nextCursor: string | null }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { items, nextCursor } = await backendFetch<FriendsPageResponse>(`/friends${query}`, {
    token,
  });
  return { friends: items.map(mapFriend), nextCursor };
}
