'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AdminNativeAdPayout } from '../model/types';

/** Реальный перевод денег через Stripe Connect — см. backend
 * `NativeAdPayoutsService.process`'s комментарий: необратимое действие,
 * только по явному решению администратора. */
export async function processNativeAdPayout(payoutId: string): Promise<AdminNativeAdPayout> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<AdminNativeAdPayout>(`/admin/native-ads/payouts/${payoutId}/process`, {
    method: 'POST',
    token,
  });
}
