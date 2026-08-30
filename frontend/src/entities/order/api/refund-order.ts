'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Order } from '../model/types';

/** Возврат целиком, владелец-only — см. `OrdersService.refund` на backend
 * (тот же `assertOwnership`/`paymentStatus`-gate, здесь только пробрасываем
 * запрос). Тот же простой throw-based контракт, что и `updateOrderStatus` —
 * это owner-facing действие в Dashboard, не анонимный клиентский путь
 * (`createOrder`/`createAppointment`), которому был нужен non-throwing
 * `Outcome`, см. ROADMAP.md §8 Phase 14 "Critical fix". */
export async function refundOrder(businessId: string, orderId: string): Promise<Order> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Order>(`/businesses/${businessId}/orders/${orderId}/refund`, {
    method: 'POST',
    token,
  });
}
