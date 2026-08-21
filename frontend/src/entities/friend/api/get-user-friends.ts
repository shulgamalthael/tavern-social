'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Friend } from '../model/types';
import { mapFriend, type FriendResponse } from './map-friend';

/** Друзья произвольного пользователя (для секции «Друзья» на его странице
 * профиля) — в отличие от `getFriends()`, который всегда про звонящего.
 * Работает и для собственного профиля тоже — один и тот же путь для обеих
 * страниц (см. `widgets/profile/ui/ProfileFriendsCard`, как и с галереей). */
export async function getUserFriends(userId: string): Promise<Friend[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const friends = await backendFetch<FriendResponse[]>(`/users/${userId}/friends`, { token });
  return friends.map(mapFriend);
}
