'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CustomEntityRecord, CustomEntityRecordValue } from '../model/types';

export async function updateCustomEntityRecord(
  businessId: string,
  entityId: string,
  recordId: string,
  data: Record<string, CustomEntityRecordValue>,
): Promise<CustomEntityRecord> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CustomEntityRecord>(
    `/businesses/${businessId}/custom-entities/${entityId}/records/${recordId}`,
    { method: 'PATCH', token, body: { data } },
  );
}
