import type { ResponsiveValue, Viewport, WebsiteBlock } from './types';

/** Каскад «свой брейкпоинт → шире» — mobile без своего значения наследует
 * tablet, tablet без своего наследует desktop, тем же принципом, что и
 * обычный CSS `min-width`-каскад (тут просто явный объект вместо
 * медиазапросов, потому что решение «какой брейкпоинт активен» принимает
 * не реальная ширина окна, а переключатель в билдере, см. `Viewport` в
 * `types.ts`). */
export function resolveResponsive<T>(value: ResponsiveValue<T>, viewport: Viewport): T {
  if (viewport === 'desktop') return value.desktop;
  if (viewport === 'tablet') return value.tablet ?? value.desktop;
  return value.mobile ?? value.tablet ?? value.desktop;
}

/** Блок скрыт на этом вьюпорте, если явно помечен — отсутствие ключа значит
 * «виден» (см. `WebsiteBlock.hidden` в `types.ts`, почему это не
 * `ResponsiveValue<boolean>` с обязательным `desktop`). */
export function isBlockHidden(block: WebsiteBlock, viewport: Viewport): boolean {
  return block.hidden?.[viewport] === true;
}
