'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CustomEntity, CustomEntityFieldType } from '../model/types';

export interface CreateCustomEntityInput {
  name: string;
  fields: Array<{ key: string; label: string; type: CustomEntityFieldType; required?: boolean }>;
}

export async function createCustomEntity(
  businessId: string,
  input: CreateCustomEntityInput,
): Promise<CustomEntity> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CustomEntity>(`/businesses/${businessId}/custom-entities`, {
    method: 'POST',
    token,
    body: input,
  });
}
