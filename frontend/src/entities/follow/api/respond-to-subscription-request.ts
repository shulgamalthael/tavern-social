'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

/** Отмена своей исходящей заявки на подписку или отклонение чужой входящей
 * — на backend это одна и та же операция (см.
 * `SubscriptionsService.respondToRequest`). */
export async function respondToSubscriptionRequest(userId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  await backendFetch<void>(`/subscriptions/requests/${userId}`, {
    method: 'DELETE',
    token,
  });
}
