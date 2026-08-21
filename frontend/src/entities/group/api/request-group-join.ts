'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Group } from '../model/types';
import { mapGroup, type GroupResponse } from './map-group';

/** Заявка на вступление в приватную группу — уникальность (не отправить
 * вторую, пока первая не рассмотрена) проверяется на backend. */
export async function requestGroupJoin(groupId: string): Promise<Group> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const group = await backendFetch<GroupResponse>(`/groups/${groupId}/join-requests`, {
    method: 'POST',
    token,
  });
  return mapGroup(group);
}
