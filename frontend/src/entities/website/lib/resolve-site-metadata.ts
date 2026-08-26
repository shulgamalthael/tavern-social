import type { PublicWebsite } from '../api/get-public-website';

export interface SiteMetadataDefaults {
  siteTitle: string;
  siteDescription?: string;
  /** OG-картинка сайта по умолчанию — логотип бизнеса, если ни одна
   * страница/пост не задали свою (`WebsitePage.ogImage`/`BlogPost.
   * coverImage`, см. вызывающий код в `generateMetadata`-функциях). */
  ogImage?: string;
}

/**
 * Общий фолбэк-порядок для заголовка/описания сайта, вынесенный сюда,
 * потому что он буквально одинаков в трёх местах (`app/site/[businessId]/
 * [[...slug]]/page.tsx`, `blog/page.tsx`, `blog/[postSlug]/page.tsx`, см.
 * ROADMAP.md §3.11/§8 Phase 10) — не совпадение трёх похожих строк, а одна
 * и та же бизнес-логика («настройки сайта → SEO-поля бизнеса → просто
 * название бизнеса»), дублирование которой было бы реальным риском
 * рассинхронизации порядка приоритетов между тремя файлами.
 */
export function resolveSiteMetadataDefaults(site: PublicWebsite): SiteMetadataDefaults {
  return {
    siteTitle: site.document?.settings.seoTitle || site.business.seoTitle || site.business.name,
    siteDescription:
      site.document?.settings.seoDescription || site.business.seoDescription || undefined,
    ogImage: site.business.logoUrl || undefined,
  };
}
