'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

export async function unassignCreatorFromNativeAd(
  campaignId: string,
  creatorProfileId: string,
): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  await backendFetch<void>(`/admin/native-ads/campaigns/${campaignId}/assign/${creatorProfileId}`, {
    method: 'DELETE',
    token,
  });
}
