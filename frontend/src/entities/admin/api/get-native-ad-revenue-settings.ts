'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { NativeAdRevenueSettings } from '../model/types';

export async function getNativeAdRevenueSettings(): Promise<NativeAdRevenueSettings> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<NativeAdRevenueSettings>('/admin/native-ads/revenue-settings', { token });
}
