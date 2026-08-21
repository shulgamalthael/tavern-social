'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

/** Отклонение не уведомляет заявителя — тот же принцип, что и у отклонённой
 * заявки в друзья (см. backend `GroupsService.rejectJoinRequest`). */
export async function rejectGroupJoinRequest(groupId: string, userId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  await backendFetch<void>(`/groups/${groupId}/join-requests/${userId}`, {
    method: 'DELETE',
    token,
  });
}
