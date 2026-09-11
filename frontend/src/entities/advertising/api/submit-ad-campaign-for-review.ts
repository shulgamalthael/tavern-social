'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AdCampaign } from '../model/types';

/** Создаёт `PaymentIntent` на весь бюджет кампании и переводит её в
 * `pending_review` — см. `AdCampaignsService.submitForReview`'s
 * комментарий. `AdCampaign.clientSecret` заполнен только в этом ответе. */
export async function submitAdCampaignForReview(
  businessId: string,
  campaignId: string,
): Promise<AdCampaign> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<AdCampaign>(
    `/businesses/${businessId}/advertising/campaigns/${campaignId}/submit`,
    { method: 'POST', token },
  );
}
