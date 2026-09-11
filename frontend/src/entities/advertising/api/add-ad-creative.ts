'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AddAdCreativeInput, AdCampaign } from '../model/types';

/** Возвращает всю кампанию (не один креатив) — тот же принцип, что и
 * backend `AdCampaignsService.addCreative`: список креативов виден только
 * как часть кампании, отдельного `GET .../creatives` нет. */
export async function addAdCreative(
  businessId: string,
  campaignId: string,
  input: AddAdCreativeInput,
): Promise<AdCampaign> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<AdCampaign>(
    `/businesses/${businessId}/advertising/campaigns/${campaignId}/creatives`,
    { method: 'POST', token, body: input },
  );
}
