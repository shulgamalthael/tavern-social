'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { WebsiteDocument } from '../model/types';

export interface PublicWebsite {
  business: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    category: string;
    capabilities: string[];
    /** Фолбэк самого низкого приоритета для `generateMetadata` — см.
     * комментарий `WebsitePublicDto.business` в backend `websites.types.ts`. */
    seoTitle: string | null;
    seoDescription: string | null;
  };
  document: WebsiteDocument | null;
  isPublished: boolean;
  publishedAt: string | null;
}

/** Без владения на backend, но не анонимно — доступно любому вошедшему в
 * Таверну пользователю (тот же `WebsitesController.getPublic`, что и
 * `/business/[id]` внутри приложения). Для настоящих анонимных посетителей
 * сайта через домен (см. корневой план задачи «multi-tenant domains») —
 * отдельная, честно публичная функция `getAnonymousPublicSite` рядом, а не
 * эта: `/business/[id]` остаётся внутренним canonical/preview маршрутом
 * приложения и специально не ослабляется. */
export async function getPublicWebsite(businessId: string): Promise<PublicWebsite> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<PublicWebsite>(`/businesses/${businessId}/website/public`, { token });
}
