'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Group, GroupType } from '../model/types';
import { mapGroup, type GroupResponse } from './map-group';

export interface UpdateGroupInput {
  name?: string;
  description?: string;
  type?: GroupType;
}

/** Владелец-only на backend (см. `GroupsService.update`). */
export async function updateGroup(groupId: string, input: UpdateGroupInput): Promise<Group> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const group = await backendFetch<GroupResponse>(`/groups/${groupId}`, {
    method: 'PATCH',
    token,
    body: input,
  });
  return mapGroup(group);
}
