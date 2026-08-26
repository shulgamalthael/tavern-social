'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { WebsiteDocument } from '../model/types';

export interface SaveWebsiteDraftResult {
  updatedAt: string;
}

/** Перезаписывает черновик целиком — билдер всегда держит весь документ в
 * памяти (см. `entities/website/model/website-store.ts`), частичный PATCH
 * только усложнил бы контракт без реальной экономии (см. backend
 * `WebsitesService.saveDraft`). */
export async function saveWebsiteDraft(
  businessId: string,
  document: WebsiteDocument,
): Promise<SaveWebsiteDraftResult> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const result = await backendFetch<{ updatedAt: string }>(`/businesses/${businessId}/website`, {
    method: 'PATCH',
    token,
    body: document,
  });
  return { updatedAt: result.updatedAt };
}
