'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Group } from '../model/types';
import { mapGroup, type GroupResponse } from './map-group';

/** Мгновенное вступление — только для открытых групп, backend отклоняет
 * запрос для приватной (см. `requestGroupJoin`). */
export async function joinGroup(groupId: string): Promise<Group> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const group = await backendFetch<GroupResponse>(`/groups/${groupId}/membership`, {
    method: 'POST',
    token,
  });
  return mapGroup(group);
}
