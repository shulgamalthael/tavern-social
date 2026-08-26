'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Product } from '../model/types';

/** Владелец-only — полный список товаров бизнеса (включая скрытые/
 * неактивные), для Dashboard-раздела «Товары». Не путать с `getPublicProducts`
 * (анонимная витрина, только активные, без внутренних полей). */
export async function getProducts(businessId: string): Promise<Product[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Product[]>(`/businesses/${businessId}/products`, { token });
}
