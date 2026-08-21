'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

/** Владелец-only, владельца удалить нельзя (см. `GroupsService.removeMember`). */
export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  await backendFetch<void>(`/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
    token,
  });
}
