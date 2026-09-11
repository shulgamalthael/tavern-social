'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AdInventory } from '../model/types';

/** Владелец-only — используется `ComponentLibraryPanel`, чтобы решить,
 * показывать ли блок «Рекламный слот» в библиотеке компонентов (отдельный
 * гейт от `Business.capabilities`, см. `AdvertisingInventoryService`'s
 * комментарий на backend). */
export async function getAdInventory(businessId: string): Promise<AdInventory> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<AdInventory>(`/businesses/${businessId}/advertising/inventory`, { token });
}
