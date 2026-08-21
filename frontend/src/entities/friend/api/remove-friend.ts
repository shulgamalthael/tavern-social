'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

/** Разрыв уже подтверждённой дружбы — не путать с `respondToFriendRequest`
 * (отмена/отклонение ещё не подтверждённой заявки), см. FriendsService.removeFriend. */
export async function removeFriend(friendId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  await backendFetch<void>(`/friends/${friendId}`, { method: 'DELETE', token });
}
