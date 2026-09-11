'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { FollowersPage } from '../model/types';
import { mapFollower, type FollowerResponse } from './map-follower';

interface FollowersPageResponse {
  items: FollowerResponse[];
  nextCursor: string | null;
}

/** Кого читает произвольный пользователь — та же курсорная пагинация, что
 * `getFollowers`, зеркальная сторона отношения. */
export async function getFollowing(userId: string, cursor?: string): Promise<FollowersPage> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const page = await backendFetch<FollowersPageResponse>(`/users/${userId}/following${query}`, {
    token,
  });
  return { items: page.items.map(mapFollower), nextCursor: page.nextCursor };
}
