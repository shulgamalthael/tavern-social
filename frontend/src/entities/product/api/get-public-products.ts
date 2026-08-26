'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import type { PublicProduct } from '../model/types';

/**
 * По-настоящему анонимный запрос (см. `PublicSitesController.
 * getPublicProducts`, тот же контроллер и тот же принцип, что и
 * `getAnonymousPublicSite`) — вызывается напрямую из клиентского
 * `ProductGridRenderer` (`entities/website/blocks/commerce`) и в билдере
 * (канвас/превью показывают ту же живую витрину, что и публичный сайт —
 * тот же принцип «Preview = тот же рендерер», уже применённый ко всему
 * остальному контенту сайта).
 */
export async function getPublicProducts(businessId: string): Promise<PublicProduct[]> {
  return backendFetch<PublicProduct[]>(`/sites/${businessId}/products`);
}
