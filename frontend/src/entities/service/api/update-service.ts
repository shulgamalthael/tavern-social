'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Service } from '../model/types';
import type { CreateServiceInput } from './create-service';

export type UpdateServiceInput = Partial<CreateServiceInput>;

export async function updateService(
  businessId: string,
  serviceId: string,
  input: UpdateServiceInput,
): Promise<Service> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Service>(`/businesses/${businessId}/services/${serviceId}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}
