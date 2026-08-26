'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import type { PublicService } from '../model/types';

/** По-настоящему анонимно — см. `getPublicProducts` в `entities/product`,
 * тот же принцип. */
export async function getPublicServices(businessId: string): Promise<PublicService[]> {
  return backendFetch<PublicService[]>(`/sites/${businessId}/services`);
}
