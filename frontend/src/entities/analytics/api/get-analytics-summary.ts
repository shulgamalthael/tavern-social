'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AnalyticsSummary } from '../model/types';

export async function getAnalyticsSummary(businessId: string): Promise<AnalyticsSummary> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<AnalyticsSummary>(`/businesses/${businessId}/analytics`, { token });
}
