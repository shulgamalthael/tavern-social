'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AdCampaign } from '../model/types';

/** Доплата бюджета к `paused`-кампании — см. `AdCampaignsService.
 * requestTopUp`'s комментарий. `AdCampaign.clientSecret` заполнен только в
 * этом ответе, как и у `submitAdCampaignForReview`. */
export async function topUpAdCampaign(
  businessId: string,
  campaignId: string,
  amountCents: number,
): Promise<AdCampaign> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<AdCampaign>(
    `/businesses/${businessId}/advertising/campaigns/${campaignId}/topup`,
    { method: 'POST', token, body: { amountCents } },
  );
}
