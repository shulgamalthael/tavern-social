'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CustomEntityRecord } from '../model/types';

export async function getCustomEntityRecords(
  businessId: string,
  entityId: string,
): Promise<CustomEntityRecord[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CustomEntityRecord[]>(
    `/businesses/${businessId}/custom-entities/${entityId}/records`,
    { token },
  );
}
