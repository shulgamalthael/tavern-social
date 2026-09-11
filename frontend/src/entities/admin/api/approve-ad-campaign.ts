'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

export async function approveAdCampaign(campaignId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  await backendFetch<void>(`/admin/advertising/campaigns/${campaignId}/approve`, {
    method: 'POST',
    token,
  });
}
