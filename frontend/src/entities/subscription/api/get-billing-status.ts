'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { BillingStatus } from '../model/types';

/** Единственный источник истины для гейта конструктора (`isGateOpen`) —
 * вызывается и серверным компонентом `/business/[id]/edit` (жёсткий гейт),
 * и клиентским `PlanSelectorWidget` (опрос статуса после Stripe Checkout). */
export async function getBillingStatus(businessId: string): Promise<BillingStatus> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<BillingStatus>(`/businesses/${businessId}/billing/status`, { token });
}
