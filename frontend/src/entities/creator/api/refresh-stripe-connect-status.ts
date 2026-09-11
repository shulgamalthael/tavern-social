'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CreatorStripeConnectStatus } from '../model/types';

/** Живой опрос реального статуса у Stripe (см. backend
 * `CreatorsService.refreshStripeConnectStatus`'s комментарий) — вызывается
 * при открытии вкладки «Доход», а не через вебхук-пуш на клиент. */
export async function refreshStripeConnectStatus(): Promise<{
  status: CreatorStripeConnectStatus;
}> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<{ status: CreatorStripeConnectStatus }>(
    '/creators/stripe-connect/refresh-status',
    { method: 'POST', token },
  );
}
