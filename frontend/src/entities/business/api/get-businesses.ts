'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Business } from '../model/types';
import { mapBusiness, type BusinessResponse } from './map-business';

/** Все бизнесы текущего пользователя, без пагинации — «своих» бизнесов у
 * одного пользователя реалистично не настолько много, чтобы это стало
 * проблемой (в отличие от каталога групп/сообществ, общего на всех). */
export async function getBusinesses(): Promise<Business[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const businesses = await backendFetch<BusinessResponse[]>('/businesses', { token });
  return businesses.map(mapBusiness);
}
