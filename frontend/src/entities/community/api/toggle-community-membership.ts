'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Community } from '../model/types';
import { mapCommunity, type CommunityResponse } from './map-community';

export async function toggleCommunityMembership(
  communityId: string,
  join: boolean,
): Promise<Community> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const community = await backendFetch<CommunityResponse>(
    `/communities/${communityId}/membership`,
    {
      method: join ? 'POST' : 'DELETE',
      token,
    },
  );
  return mapCommunity(community);
}
