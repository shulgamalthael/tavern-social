import type { WebsiteBlock } from './types';

/**
 * Есть ли на верхнем уровне страницы `businessheader` со включённой кнопкой
 * корзины (`HeaderActions.tsx`, поле `showCart`) — используют оба места,
 * что монтируют плавающий `CartWidget` (`PublicSiteWidget.tsx`/
 * `BusinessPageWidget.tsx`), чтобы спрятать его собственный `.fab`
 * (`hideFab`) и не показать посетителю две корзины сразу: обе кнопки
 * дёргают один и тот же `useCartStore.open()`. Шапка не бывает вложенной в
 * другой блок, поэтому достаточно верхнего уровня, без рекурсии по дереву.
 */
export function pageHasHeaderCartButton(blocks: WebsiteBlock[]): boolean {
  return blocks.some((block) => block.type === 'businessheader' && block.props.showCart === true);
}
