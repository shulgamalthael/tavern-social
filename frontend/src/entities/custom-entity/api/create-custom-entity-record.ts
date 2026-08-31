'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CustomEntityRecord, CustomEntityRecordValue } from '../model/types';

export async function createCustomEntityRecord(
  businessId: string,
  entityId: string,
  data: Record<string, CustomEntityRecordValue>,
): Promise<CustomEntityRecord> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CustomEntityRecord>(
    `/businesses/${businessId}/custom-entities/${entityId}/records`,
    { method: 'POST', token, body: { data } },
  );
}
