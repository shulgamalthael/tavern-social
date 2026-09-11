'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CreatorRevenueSummary } from '../model/types';

/** Creator Studio → «Доход» — см. `CreatorRevenueSummary`'s комментарий. */
export async function getMyNativeRevenue(): Promise<CreatorRevenueSummary> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CreatorRevenueSummary>('/native-ads/my-revenue', { token });
}
