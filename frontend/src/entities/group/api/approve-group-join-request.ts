'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Group } from '../model/types';
import { mapGroup, type GroupResponse } from './map-group';

export async function approveGroupJoinRequest(groupId: string, userId: string): Promise<Group> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const group = await backendFetch<GroupResponse>(
    `/groups/${groupId}/join-requests/${userId}/approve`,
    { method: 'POST', token },
  );
  return mapGroup(group);
}
