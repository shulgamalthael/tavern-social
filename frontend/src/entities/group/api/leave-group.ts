'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Group } from '../model/types';
import { mapGroup, type GroupResponse } from './map-group';

/** Владелец не может покинуть свою группу — backend отклоняет запрос (см.
 * `GroupsService.leave`). */
export async function leaveGroup(groupId: string): Promise<Group> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const group = await backendFetch<GroupResponse>(`/groups/${groupId}/membership`, {
    method: 'DELETE',
    token,
  });
  return mapGroup(group);
}
