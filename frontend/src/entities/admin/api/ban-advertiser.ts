'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

export async function banAdvertiser(businessId: string, reason?: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  await backendFetch<void>(`/admin/advertising/businesses/${businessId}/ban`, {
    method: 'POST',
    token,
    body: { reason },
  });
}
