'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

export async function rejectNativeAdCampaign(campaignId: string, reason?: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  await backendFetch<void>(`/admin/native-ads/campaigns/${campaignId}/reject`, {
    method: 'POST',
    token,
    body: { reason },
  });
}
