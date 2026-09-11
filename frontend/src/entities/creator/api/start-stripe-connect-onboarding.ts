'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

/** Creator Studio → «Доход» → «Подключить выплаты через Stripe» — см.
 * backend `CreatorsService.startStripeConnectOnboarding`'s комментарий.
 * Возвращает URL хостед-онбординга Stripe, на который редиректит клиент. */
export async function startStripeConnectOnboarding(): Promise<{ url: string }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<{ url: string }>('/creators/stripe-connect/onboarding-link', {
    method: 'POST',
    token,
  });
}
