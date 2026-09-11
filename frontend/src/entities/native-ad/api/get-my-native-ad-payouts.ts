'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { NativeAdPayout } from '../model/types';

/** Creator Studio → «Доход» → история выплат. */
export async function getMyNativeAdPayouts(): Promise<NativeAdPayout[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<NativeAdPayout[]>('/native-ads/my-payouts', { token });
}
