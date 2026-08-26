'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

export async function publishWebsite(businessId: string): Promise<{ publishedAt: string }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const response = await backendFetch<{ updatedAt: string }>(
    `/businesses/${businessId}/website/publish`,
    {
      method: 'POST',
      token,
    },
  );
  return { publishedAt: response.updatedAt };
}
