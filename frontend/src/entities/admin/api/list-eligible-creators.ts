'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { EligibleCreator } from '../model/types';

export async function listEligibleCreators(): Promise<EligibleCreator[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<EligibleCreator[]>('/admin/native-ads/eligible-creators', { token });
}
