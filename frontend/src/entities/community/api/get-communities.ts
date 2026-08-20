'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Community } from '../model/types';
import { mapCommunity, type CommunityResponse } from './map-community';

export async function getCommunities(): Promise<Community[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const communities = await backendFetch<CommunityResponse[]>('/communities', { token });
  return communities.map(mapCommunity);
}
