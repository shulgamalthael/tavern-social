'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Business, BusinessCategory } from '../model/types';
import { mapBusiness, type BusinessResponse } from './map-business';

export interface CreateBusinessInput {
  name: string;
  slug?: string;
  description?: string;
  category: BusinessCategory;
  /** Необязательна на уровне типа (backend подставляет `DEFAULT_BUSINESS_
   * CURRENCY`, если не передана) — но `CreateBusinessForm.tsx` всегда шлёт
   * выбранное значение (Currency System, ROADMAP.md §8). */
  currency?: string;
  /** Только `AdvertiserSignupForm.tsx` (`/advertise/new`) шлёт `true` — см.
   * `Business.isAdvertiserOnly`'s комментарий в schema.prisma. */
  isAdvertiserOnly?: boolean;
}

/** Создаёт бизнес и — на backend, одной транзакцией — пустой сайт вместе с
 * ним (см. `BusinessesService.create`), поэтому сразу после этого вызова
 * `/business/[id]` уже может смотреть на билдер, не проверяя отдельно
 * «а есть ли уже сайт». */
export async function createBusiness(input: CreateBusinessInput): Promise<Business> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const business = await backendFetch<BusinessResponse>('/businesses', {
    method: 'POST',
    token,
    body: input,
  });
  return mapBusiness(business);
}
