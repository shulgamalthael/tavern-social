'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { NativeAdPayout } from '../model/types';

/** Creator Studio → «Доход» → «Запросить выплату» — см. backend
 * `NativeAdPayoutsService.requestPayout`'s комментарий: реальный перевод
 * денег происходит только после admin'ского `process`. */
export async function requestNativeAdPayout(currency: string): Promise<NativeAdPayout> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<NativeAdPayout>('/native-ads/my-revenue/request-payout', {
    method: 'POST',
    token,
    body: { currency },
  });
}
