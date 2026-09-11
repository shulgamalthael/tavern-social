'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AdCampaign } from '../model/types';

export async function removeAdCreative(
  businessId: string,
  campaignId: string,
  creativeId: string,
): Promise<AdCampaign> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<AdCampaign>(
    `/businesses/${businessId}/advertising/campaigns/${campaignId}/creatives/${creativeId}`,
    { method: 'DELETE', token },
  );
}
