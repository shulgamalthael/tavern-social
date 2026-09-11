'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { NativeAdAssignment } from '../model/types';

export async function listNativeAdAssignments(campaignId: string): Promise<NativeAdAssignment[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<NativeAdAssignment[]>(
    `/admin/native-ads/campaigns/${campaignId}/assignments`,
    { token },
  );
}
