'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { ConnectDomainResult } from '../model/types';

export async function connectDomain(
  businessId: string,
  hostname: string,
): Promise<ConnectDomainResult> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<ConnectDomainResult>(`/businesses/${businessId}/domains`, {
    method: 'POST',
    token,
    body: { hostname },
  });
}
