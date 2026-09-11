'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CreatorNativeAd } from '../model/types';

/** Creator Studio → «Реклама» — см. `CreatorNativeAd`'s комментарий. */
export async function getMyNativeAds(): Promise<CreatorNativeAd[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CreatorNativeAd[]>('/native-ads/my-assignments', { token });
}
