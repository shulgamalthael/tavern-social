'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AdminNativeAdsOverview } from '../model/types';

export async function getNativeAdsOverview(): Promise<AdminNativeAdsOverview> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<AdminNativeAdsOverview>('/admin/native-ads/overview', { token });
}
