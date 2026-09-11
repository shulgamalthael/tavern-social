'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { RecommendedCreator } from '../model/types';

export async function listRecommendedCreators(campaignId: string): Promise<RecommendedCreator[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<RecommendedCreator[]>(
    `/admin/native-ads/campaigns/${campaignId}/recommended-creators`,
    { token },
  );
}
