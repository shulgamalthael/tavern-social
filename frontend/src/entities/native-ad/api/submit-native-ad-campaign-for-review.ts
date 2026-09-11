'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { NativeAdCampaign } from '../model/types';

export async function submitNativeAdCampaignForReview(
  businessId: string,
  campaignId: string,
): Promise<NativeAdCampaign> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<NativeAdCampaign>(
    `/businesses/${businessId}/native-ad-campaigns/${campaignId}/submit`,
    { method: 'POST', token },
  );
}
