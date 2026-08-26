import type { WebsiteDocument, WebsitePage } from './types';

/** Первая страница по порядку — всегда домашняя, открывается по голому
 * адресу сайта без сегмента пути (см. backend `WebsitePage` в
 * `schema.prisma` — та же позиционная логика при сборке `Website.
 * published`, не отдельный флаг). Остальные — по `/[slug]`. Используется и
 * публичной страницей (`app/site/[businessId]/[[...slug]]/page.tsx`,
 * `PublicSiteWidget`), и превью — единственное место, которое знает, как
 * путь превращается в конкретную страницу документа, не дублируется в
 * каждом потребителе по отдельности.
 *
 * `slugSegments` — то, что Next.js отдаёт для catch-all сегмента
 * (`[[...slug]]`): `undefined`/`[]` для голого адреса сайта, `['about']` для
 * `/about`, `['blog', 'post-1']` для вложенных путей (страницы сайта сейчас
 * не вложены — многосегментный путь просто не найдёт совпадения и даст
 * `null`, как и любой другой несуществующий slug). */
export function resolveSitePage(
  document: WebsiteDocument,
  slugSegments: string[] | undefined,
): WebsitePage | null {
  if (!slugSegments || slugSegments.length === 0) {
    return document.pages[0] ?? null;
  }

  const slug = slugSegments.join('/');
  return document.pages.find((page) => page.slug === slug) ?? null;
}
