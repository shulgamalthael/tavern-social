'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Domain } from '../model/types';

/** Ручная проверка по кнопке «Проверить DNS» — без polling (см. корневой
 * план задачи, раздел «Domain connection UX»): пользователь сам решает,
 * когда пробовать снова, после того как поправил DNS-запись. */
export async function verifyDomain(businessId: string, domainId: string): Promise<Domain> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Domain>(`/businesses/${businessId}/domains/${domainId}/verify`, {
    method: 'POST',
    token,
  });
}
