'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

export async function deleteCustomEntityRecord(
  businessId: string,
  entityId: string,
  recordId: string,
): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  await backendFetch<void>(
    `/businesses/${businessId}/custom-entities/${entityId}/records/${recordId}`,
    { method: 'DELETE', token },
  );
}
