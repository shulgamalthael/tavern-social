'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Business } from '../model/types';
import { mapBusiness, type BusinessResponse } from './map-business';

export async function getBusiness(businessId: string): Promise<Business> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const business = await backendFetch<BusinessResponse>(`/businesses/${businessId}`, { token });
  return mapBusiness(business);
}
