'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Discount, DiscountType } from '../model/types';

export interface CreateDiscountInput {
  name: string;
  code?: string;
  type: DiscountType;
  value: number;
  minOrderAmountCents?: number;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number;
  isActive?: boolean;
}

export async function createDiscount(
  businessId: string,
  input: CreateDiscountInput,
): Promise<Discount> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Discount>(`/businesses/${businessId}/discounts`, {
    method: 'POST',
    token,
    body: input,
  });
}
