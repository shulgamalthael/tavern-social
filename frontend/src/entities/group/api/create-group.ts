'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Group, GroupType } from '../model/types';
import { mapGroup, type GroupResponse } from './map-group';

export interface CreateGroupInput {
  name: string;
  description: string;
  type: GroupType;
}

/** Создатель автоматически становится владельцем+участником — см.
 * `GroupsService.create` на backend. */
export async function createGroup(input: CreateGroupInput): Promise<Group> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const group = await backendFetch<GroupResponse>('/groups', {
    method: 'POST',
    token,
    body: input,
  });
  return mapGroup(group);
}
