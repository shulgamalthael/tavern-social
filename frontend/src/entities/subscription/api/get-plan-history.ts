'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { PlanEvent } from '../model/types';

export async function getPlanHistory(businessId: string): Promise<PlanEvent[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<PlanEvent[]>(`/businesses/${businessId}/billing/history`, { token });
}
