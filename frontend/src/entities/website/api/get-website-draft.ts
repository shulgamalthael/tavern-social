'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { WebsiteDocument } from '../model/types';

export interface WebsiteDraft {
  document: WebsiteDocument;
  updatedAt: string;
}

/** Владелец-only на backend (см. `WebsitesService.getDraft`). Используется
 * и билдером, и его Preview — оба читают один и тот же черновик через один
 * и тот же renderer (см. `entities/website/ui/WebsiteRenderer.tsx`). */
export async function getWebsiteDraft(businessId: string): Promise<WebsiteDraft> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const response = await backendFetch<{
    businessId: string;
    document: WebsiteDocument;
    updatedAt: string;
  }>(`/businesses/${businessId}/website`, { token });
  return { document: response.document, updatedAt: response.updatedAt };
}
