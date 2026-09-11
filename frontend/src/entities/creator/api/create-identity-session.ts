'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CreatorIdentitySession } from '../model/types';

export async function createIdentitySession(): Promise<CreatorIdentitySession> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CreatorIdentitySession>('/creators/identity-session', {
    method: 'POST',
    token,
  });
}
