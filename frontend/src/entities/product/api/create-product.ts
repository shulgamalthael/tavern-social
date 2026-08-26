'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Product } from '../model/types';

export interface CreateProductInput {
  name: string;
  slug?: string;
  description?: string;
  priceCents: number;
  images?: string[];
  stock?: number | null;
  isActive?: boolean;
}

export async function createProduct(
  businessId: string,
  input: CreateProductInput,
): Promise<Product> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Product>(`/businesses/${businessId}/products`, {
    method: 'POST',
    token,
    body: input,
  });
}
