'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Community } from '../model/types';
import { mapCommunity, type CommunityResponse } from './map-community';

interface CommunitiesPageResponse {
  items: CommunityResponse[];
  nextCursor: string | null;
}

export async function getCommunities(
  cursor?: string | null,
): Promise<{ communities: Community[]; nextCursor: string | null }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { items, nextCursor } = await backendFetch<CommunitiesPageResponse>(
    `/communities${query}`,
    { token },
  );
  return { communities: items.map(mapCommunity), nextCursor };
}
