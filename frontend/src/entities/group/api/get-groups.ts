'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Group } from '../model/types';
import { mapGroup, type GroupResponse } from './map-group';

interface GroupsPageResponse {
  items: GroupResponse[];
  nextCursor: string | null;
}

/** Каталог групп — виден всем, включая приватные (по названию/описанию),
 * тем же принципом, что и `getCommunities` (см. AGENTS.md/план по группам). */
export async function getGroups(
  cursor?: string | null,
): Promise<{ groups: Group[]; nextCursor: string | null }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { items, nextCursor } = await backendFetch<GroupsPageResponse>(`/groups${query}`, {
    token,
  });
  return { groups: items.map(mapGroup), nextCursor };
}
