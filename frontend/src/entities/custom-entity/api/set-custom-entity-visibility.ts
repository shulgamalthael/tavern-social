'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CustomEntity } from '../model/types';

/** Единственное место, откуда можно включить/выключить `CustomEntity.
 * isPublic` — см. её комментарий на backend (`schema.prisma`)/
 * `SetCustomEntityVisibilityDto`: отдельный узкий эндпоинт, не поле общего
 * PATCH, чтобы само действие "сделать данные публичными" оставалось явным
 * и однозначным в коде, а не терялось среди прочих полей формы. */
export async function setCustomEntityVisibility(
  businessId: string,
  entityId: string,
  isPublic: boolean,
): Promise<CustomEntity> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CustomEntity>(
    `/businesses/${businessId}/custom-entities/${entityId}/visibility`,
    {
      method: 'PATCH',
      token,
      body: { isPublic },
    },
  );
}
