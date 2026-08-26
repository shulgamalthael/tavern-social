'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import type { PublicWebsite } from './get-public-website';

/**
 * По-настоящему анонимный запрос — без сессии Таверны вообще (см.
 * `backend/src/modules/public-sites/public-sites.controller.ts`,
 * единственный контроллер без `SessionAuthGuard`). Используется только
 * `/site/[businessId]` (см. `app/site/[businessId]/page.tsx`) — страницей,
 * на которую `proxy.ts` переписывает запросы к системным сабдоменам и
 * подключённым custom domains. Не путать с `getPublicWebsite` — та всё ещё
 * требует быть вошедшим в Таверну (используется внутренним `/business/[id]`).
 */
export async function getAnonymousPublicSite(businessId: string): Promise<PublicWebsite> {
  return backendFetch<PublicWebsite>(`/sites/${businessId}`);
}
