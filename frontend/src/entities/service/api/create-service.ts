'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Service } from '../model/types';

export interface CreateServiceInput {
  name: string;
  slug?: string;
  description?: string;
  durationMinutes: number;
  priceCents: number;
  images?: string[];
  isActive?: boolean;
}

export async function createService(
  businessId: string,
  input: CreateServiceInput,
): Promise<Service> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Service>(`/businesses/${businessId}/services`, {
    method: 'POST',
    token,
    body: input,
  });
}
