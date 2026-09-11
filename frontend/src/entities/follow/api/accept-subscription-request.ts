'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

export async function acceptSubscriptionRequest(senderId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  await backendFetch<void>(`/subscriptions/requests/${senderId}/accept`, {
    method: 'POST',
    token,
  });
}
