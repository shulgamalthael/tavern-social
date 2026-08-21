'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { GroupJoinRequest } from '../model/types';
import { mapGroupJoinRequest, type GroupJoinRequestResponse } from './map-group';

interface GroupJoinRequestsPageResponse {
  items: GroupJoinRequestResponse[];
  nextCursor: string | null;
}

/** Владелец-only на backend (403 для остальных). */
export async function getGroupJoinRequests(
  groupId: string,
  cursor?: string | null,
): Promise<{ requests: GroupJoinRequest[]; nextCursor: string | null }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { items, nextCursor } = await backendFetch<GroupJoinRequestsPageResponse>(
    `/groups/${groupId}/join-requests${query}`,
    { token },
  );
  return { requests: items.map(mapGroupJoinRequest), nextCursor };
}
