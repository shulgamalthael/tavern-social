'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Discount, DiscountType } from '../model/types';

export interface UpdateDiscountInput {
  name?: string;
  code?: string | null;
  type?: DiscountType;
  value?: number;
  minOrderAmountCents?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  isActive?: boolean;
}

export async function updateDiscount(
  businessId: string,
  discountId: string,
  input: UpdateDiscountInput,
): Promise<Discount> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Discount>(`/businesses/${businessId}/discounts/${discountId}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}
