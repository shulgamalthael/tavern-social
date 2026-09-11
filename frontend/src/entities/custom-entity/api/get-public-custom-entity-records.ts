'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import type { PublicCustomEntity } from '../model/types';

/**
 * По-настоящему анонимный запрос — см. `getPublicProducts` (`entities/
 * product`), тот же принцип и тот же контроллер (`PublicSitesController`).
 * Резолвится ПО ИМЕНИ сущности (`entityName`), не по id — см.
 * `PublicCustomEntityDto`'s комментарий на backend. Бросает (через
 * `backendFetch`), если сущности с таким именем нет ИЛИ она не помечена
 * `isPublic` — вызывающий код (`EntitySearchRenderer`, `entities/website/
 * blocks/navigation`) должен считать оба случая "источник недоступен", не
 * различать их для посетителя.
 */
export async function getPublicCustomEntityRecords(
  businessId: string,
  entityName: string,
): Promise<PublicCustomEntity> {
  return backendFetch<PublicCustomEntity>(
    `/sites/${businessId}/custom-entities/${encodeURIComponent(entityName)}/records`,
  );
}
