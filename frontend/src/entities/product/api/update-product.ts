'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Product } from '../model/types';
import type { CreateProductInput } from './create-product';

export type UpdateProductInput = Partial<CreateProductInput>;

export async function updateProduct(
  businessId: string,
  productId: string,
  input: UpdateProductInput,
): Promise<Product> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Product>(`/businesses/${businessId}/products/${productId}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}
