'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Rule } from '../model/types';

/** Владелец-only — полный список правил бизнеса, для Dashboard-раздела
 * «Автоматизация» (тот же принцип, что у `getDiscounts`). */
export async function getRules(businessId: string): Promise<Rule[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Rule[]>(`/businesses/${businessId}/rules`, { token });
}
