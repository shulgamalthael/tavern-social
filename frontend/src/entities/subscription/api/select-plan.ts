'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { BillingStatus, SelectablePlanTier } from '../model/types';

export interface SelectPlanResult {
  status: BillingStatus;
  /** Присутствует, только если нужно впервые привязать способ оплаты (не
   * было живой Stripe-подписки) — иначе смена тарифа происходит сразу же,
   * без редиректа на Stripe Checkout (см. `BillingService.selectPlan`). */
  checkoutUrl?: string;
}

/** Единая точка "сменить тариф в любой момент" — Free выбирается так же,
 * как и любой платный тир; переключение между уже оплачиваемыми платными
 * тирами меняет цену существующей Stripe-подписки без повторного чекаута
 * (см. backend `BillingService.selectPlan`'s комментарий). */
export async function selectPlan(
  businessId: string,
  tier: SelectablePlanTier,
): Promise<SelectPlanResult> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<SelectPlanResult>(`/businesses/${businessId}/billing/select-plan`, {
    method: 'POST',
    token,
    body: { tier },
  });
}
