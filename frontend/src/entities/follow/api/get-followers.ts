'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { FollowersPage } from '../model/types';
import { mapFollower, type FollowerResponse } from './map-follower';

interface FollowersPageResponse {
  items: FollowerResponse[];
  nextCursor: string | null;
}

/** Подписчики произвольного пользователя — курсорная пагинация (не единый
 * запрос с максимальным лимитом, как `getUserFriends`): в отличие от друзей,
 * число подписчиков ничем не ограничено, см. backend `SubscriptionsService.
 * listFollowers`'s комментарий. */
export async function getFollowers(userId: string, cursor?: string): Promise<FollowersPage> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const page = await backendFetch<FollowersPageResponse>(`/users/${userId}/followers${query}`, {
    token,
  });
  return { items: page.items.map(mapFollower), nextCursor: page.nextCursor };
}
