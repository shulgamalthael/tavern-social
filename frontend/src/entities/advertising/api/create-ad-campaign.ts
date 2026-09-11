'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AdCampaign, CreateAdCampaignInput } from '../model/types';

export async function createAdCampaign(
  businessId: string,
  input: CreateAdCampaignInput,
): Promise<AdCampaign> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<AdCampaign>(`/businesses/${businessId}/advertising/campaigns`, {
    method: 'POST',
    token,
    body: input,
  });
}
