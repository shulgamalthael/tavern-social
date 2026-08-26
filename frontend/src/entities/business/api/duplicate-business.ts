'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Business } from '../model/types';
import { mapBusiness, type BusinessResponse } from './map-business';

/** Копирует бизнес и черновик его сайта (не опубликованную версию) — см.
 * `BusinessesService.duplicate`. */
export async function duplicateBusiness(businessId: string): Promise<Business> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const business = await backendFetch<BusinessResponse>(`/businesses/${businessId}/duplicate`, {
    method: 'POST',
    token,
  });
  return mapBusiness(business);
}
