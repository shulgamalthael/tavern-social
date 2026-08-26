import type { Metadata } from 'next';
import {
  getAnonymousPublicSite,
  resolveSitePage,
  resolveSiteMetadataDefaults,
} from '@/entities/website';
import { PublicSiteWidget } from '@/widgets/public-site';

interface PublicSitePageProps {
  params: Promise<{ businessId: string; slug?: string[] }>;
}

/** Своя вкладка браузера для опубликованного сайта (название бизнеса или
 * его SEO-заголовок, не заголовок Таверны из корневого `layout.tsx`) — тот
 * же анонимный запрос, что и у самого виджета (`PublicSiteWidget`), лишний
 * второй round-trip ради этого — сознательный компромисс простоты для MVP
 * (см. корневой план задачи: «MVP > overengineering»).
 *
 * Постраничный SEO (ROADMAP.md §3.11/§8 Phase 10) — `page.seoTitle`, если
 * задан, используется КАК ЕСТЬ, не склеивается с названием сайта через
 * тире: владелец, явно заполнивший это поле, получает ровно тот заголовок,
 * который написал, а не наш собственный формат поверх него. Без
 * явного `seoTitle` — прежнее поведение (`"{заголовок страницы} —
 * {заголовок сайта}"`, для домашней страницы — просто заголовок сайта).
 * `openGraph` — первое, что появляется в проекте (см. `resolveSite
 * MetadataDefaults`, `entities/website/lib/resolve-site-metadata.ts`):
 * `page.ogImage` → логотип бизнеса → ничего. */
export async function generateMetadata({ params }: PublicSitePageProps): Promise<Metadata> {
  const { businessId, slug } = await params;
  try {
    const site = await getAnonymousPublicSite(businessId);
    if (!site.document) return {};

    const page = resolveSitePage(site.document, slug);
    const isHome = page === site.document.pages[0];
    const defaults = resolveSiteMetadataDefaults(site);

    const title = page?.seoTitle
      ? page.seoTitle
      : page && !isHome
        ? `${page.title} — ${defaults.siteTitle}`
        : defaults.siteTitle;
    const description = page?.seoDescription || defaults.siteDescription;
    const ogImage = page?.ogImage || defaults.ogImage;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: ogImage ? [{ url: ogImage }] : undefined,
      },
    };
  } catch {
    return {};
  }
}

/**
 * Единственная страница, на которую `proxy.ts` переписывает запросы к
 * системным сабдоменам/подключённым custom domains (см. корневой план
 * задачи «multi-tenant domains») — вне `(protected)`, без единой проверки
 * сессии: настоящий посетитель сайта не обязан иметь аккаунт в Таверне
 * (см. `PublicSiteWidget`). Catch-all сегмент (`[[...slug]]`) — один
 * физический файл на ЛЮБУЮ страницу ЛЮБОГО сайта, не файл на страницу (см.
 * ROADMAP.md §3.2) — какую именно страницу документа показать по этому
 * `slug`, решает `resolveSitePage` внутри `PublicSiteWidget`, не эта
 * серверная обёртка.
 */
export default async function PublicSitePage({ params }: PublicSitePageProps) {
  const { businessId, slug } = await params;
  return <PublicSiteWidget businessId={businessId} slug={slug} />;
}
