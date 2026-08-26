'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Discount } from '../model/types';

/** Владелец-only — полный список скидок бизнеса, для Dashboard-раздела
 * «Скидки» (тот же принцип, что у `getProducts`). */
export async function getDiscounts(businessId: string): Promise<Discount[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Discount[]>(`/businesses/${businessId}/discounts`, { token });
}
