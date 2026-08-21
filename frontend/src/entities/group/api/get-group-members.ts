'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { GroupMember } from '../model/types';
import { mapGroupMember, type GroupMemberResponse } from './map-group';

interface GroupMembersPageResponse {
  items: GroupMemberResponse[];
  nextCursor: string | null;
}

/** 403 на backend для приватной группы, в которой пользователь не участник
 * (см. `GroupsService.listMembers`). */
export async function getGroupMembers(
  groupId: string,
  cursor?: string | null,
): Promise<{ members: GroupMember[]; nextCursor: string | null }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { items, nextCursor } = await backendFetch<GroupMembersPageResponse>(
    `/groups/${groupId}/members${query}`,
    { token },
  );
  return { members: items.map(mapGroupMember), nextCursor };
}
