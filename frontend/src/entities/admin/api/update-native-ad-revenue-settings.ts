'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { NativeAdRevenueSettings, UpdateNativeAdRevenueSettingsInput } from '../model/types';

export async function updateNativeAdRevenueSettings(
  input: UpdateNativeAdRevenueSettingsInput,
): Promise<NativeAdRevenueSettings> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<NativeAdRevenueSettings>('/admin/native-ads/revenue-settings', {
    method: 'PATCH',
    token,
    body: input,
  });
}
