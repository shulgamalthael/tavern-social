'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CustomEntity, CustomEntityFieldType } from '../model/types';

export interface AddCustomEntityFieldInput {
  key: string;
  label: string;
  type: CustomEntityFieldType;
  required?: boolean;
}

export async function addCustomEntityField(
  businessId: string,
  entityId: string,
  field: AddCustomEntityFieldInput,
): Promise<CustomEntity> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CustomEntity>(
    `/businesses/${businessId}/custom-entities/${entityId}/fields`,
    { method: 'POST', token, body: { field } },
  );
}
