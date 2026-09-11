'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { WebsiteDocument } from '../model/types';

export interface PublicWebsiteSocialLink {
  platform: string;
  url: string;
}

/** Независимая копия формы `entities/business`'s `WorkingHours` — тот же
 * приём, что и у backend `add-block-schemas.ts`, независимо копирующего
 * frontend-контракт: `entities/website` не может импортировать `entities/
 * business` напрямую (оба — `entities`, «вбок» запрещён правилами FSD, см.
 * `AGENTS.md` §3), а часы работы этому виджету нужны только как курируемые
 * `open`/`close`-строки, не полная модель бизнеса. Ключ дня отсутствует или
 * всё поле `null` — значит «не ограничено» (то же самое, что у оригинала). */
export type PublicWorkingHours = Partial<
  Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', { open: string; close: string }>
>;

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
    /** См. комментарий `WebsitePublicDto.business` в backend
     * `websites.types.ts` — публикуются анонимно намеренно, это ровно те
     * данные, которые `contact`/`location`/`sociallinks`/`businesshours`
     * блоки обещают показать настоящему посетителю сайта. */
    email: string | null;
    phone: string | null;
    address: string | null;
    socialLinks: PublicWebsiteSocialLink[];
    workingHours: PublicWorkingHours | null;
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
