'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AddNativeAdCreativeInput, NativeAdCampaign } from '../model/types';

export async function addNativeAdCreative(
  businessId: string,
  campaignId: string,
  input: AddNativeAdCreativeInput,
): Promise<NativeAdCampaign> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<NativeAdCampaign>(
    `/businesses/${businessId}/native-ad-campaigns/${campaignId}/creatives`,
    { method: 'POST', token, body: input },
  );
}
