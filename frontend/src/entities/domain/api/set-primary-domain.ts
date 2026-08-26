'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Domain } from '../model/types';

export async function setPrimaryDomain(businessId: string, domainId: string): Promise<Domain[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Domain[]>(`/businesses/${businessId}/domains/${domainId}/primary`, {
    method: 'POST',
    token,
  });
}
