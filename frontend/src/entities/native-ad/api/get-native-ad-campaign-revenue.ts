'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { NativeAdCampaignRevenueBreakdown } from '../model/types';

export async function getNativeAdCampaignRevenue(
  businessId: string,
  campaignId: string,
): Promise<NativeAdCampaignRevenueBreakdown> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<NativeAdCampaignRevenueBreakdown>(
    `/businesses/${businessId}/native-ad-campaigns/${campaignId}/revenue-breakdown`,
    { token },
  );
}
