'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CustomEntity } from '../model/types';

/** Владелец-only — полный список сущностей бизнеса (тот же принцип, что
 * `getRules`/`getCustomWidgets`). */
export async function getCustomEntities(businessId: string): Promise<CustomEntity[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CustomEntity[]>(`/businesses/${businessId}/custom-entities`, { token });
}
