'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

/** Только логирует интерес к Enterprise — НЕ открывает гейт конструктора
 * (см. `BillingService.recordEnterpriseInquiry`). */
export async function recordEnterpriseInquiry(businessId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  await backendFetch<void>(`/businesses/${businessId}/billing/enterprise-inquiry`, {
    method: 'POST',
    token,
  });
}
