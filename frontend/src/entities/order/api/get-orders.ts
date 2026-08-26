'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Order } from '../model/types';

export async function getOrders(businessId: string): Promise<Order[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Order[]>(`/businesses/${businessId}/orders`, { token });
}
