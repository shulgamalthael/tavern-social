'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CreateNativeAdCampaignInput, NativeAdCampaign } from '../model/types';

export async function createNativeAdCampaign(
  businessId: string,
  input: CreateNativeAdCampaignInput,
): Promise<NativeAdCampaign> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<NativeAdCampaign>(`/businesses/${businessId}/native-ad-campaigns`, {
    method: 'POST',
    token,
    body: input,
  });
}
