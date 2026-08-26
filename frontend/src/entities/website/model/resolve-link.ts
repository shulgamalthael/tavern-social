import type { LinkTarget, WebsitePage } from './types';

/** Значение по умолчанию для нового поля-ссылки — внешняя ссылка с пустым
 * URL, тот же нейтральный старт, что раньше был у пустой строки в обычном
 * `control: 'url'`. */
export const EMPTY_LINK_TARGET: LinkTarget = { type: 'external', url: '' };

/**
 * `LinkTarget` → реальный `href` — единственное место, которое умеет это
 * делать, вызывается и билдером (канвас/превью), и публичным рендерером (см.
 * `BlockRenderer.tsx`, `CanvasBlock.tsx`), поэтому ссылка выглядит и ведёт
 * одинаково везде.
 *
 * Первая страница по порядку — домашняя, открывается по голому адресу сайта
 * без сегмента пути (тот же принцип, что и в `resolveSitePage.ts`/backend
 * `WebsitePage`) — поэтому ссылка на неё это `/`, а не `/её-slug`. Ссылка на
 * страницу разрешается КОРНЕВЫМ (`/slug`) путём — корректно для реального
 * посетителя сайта (домен или системный сабдомен, см. `proxy.ts`: адресная
 * строка браузера остаётся доменом сайта, а не `/site/[businessId]/...`,
 * даже когда рерайт технически проксирует через этот путь). Не подходит
 * только для прямого внутреннего тестирования по пути `/site/[businessId]`
 * без реального домена — известное и осознанное ограничение, см.
 * ROADMAP.md.
 *
 * Удалённая страница (id есть в ссылке, но нет среди актуальных страниц) —
 * не повод падать: откатываемся на домашнюю, а не рисуем битую ссылку (тот
 * же принцип «битые данные не должны ломать рендер», что и у fallback для
 * неизвестного типа блока в `CanvasBlock.tsx`).
 */
export function resolveLinkHref(target: LinkTarget | undefined, pages: WebsitePage[]): string {
  if (!target) return '#';

  switch (target.type) {
    case 'external':
      return target.url || '#';
    case 'anchor':
      return target.anchor ? `#${target.anchor.replace(/^#/, '')}` : '#';
    case 'phone':
      return target.phone ? `tel:${target.phone}` : '#';
    case 'email':
      return target.email ? `mailto:${target.email}` : '#';
    case 'page': {
      const index = pages.findIndex((page) => page.id === target.pageId);
      if (index === -1) return '/';
      return index === 0 ? '/' : `/${pages[index].slug}`;
    }
    default:
      return '#';
  }
}

/** Короткая подпись значения ссылки для инспектора/превью — не сам `href`
 * (тот резолвится лениво в момент рендера, см. `resolveLinkHref`), а то, что
 * пользователь должен увидеть рядом с выбором «Страница сайта», чтобы
 * понимать, на какую именно страницу он сейчас ссылается. */
export function describeLinkTarget(target: LinkTarget | undefined, pages: WebsitePage[]): string {
  if (!target) return '';
  switch (target.type) {
    case 'external':
      return target.url;
    case 'anchor':
      return `#${target.anchor}`;
    case 'phone':
      return target.phone;
    case 'email':
      return target.email;
    case 'page':
      return pages.find((page) => page.id === target.pageId)?.title ?? 'Страница удалена';
    default:
      return '';
  }
}
