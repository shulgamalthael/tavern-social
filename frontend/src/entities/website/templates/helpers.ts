import { createBlockId } from '../model/block-tree';
import { createBlockInstance } from '../model/registry';
import type { BlockStyle, WebsiteBlock } from '../model/types';

/** Блок нужного типа с дефолтными пропсами реестра, поверх которых наложен
 * `propsOverride` — так шаблоны (см. `restaurant.ts`/`agency.ts`/`local-
 * business.ts`) описывают только то, чем конкретный сайт отличается от
 * дефолта блока, а не весь набор полей заново. */
export function block(
  type: string,
  propsOverride: Record<string, unknown> = {},
  style?: BlockStyle,
): WebsiteBlock {
  const instance = createBlockInstance(type, createBlockId());
  return {
    ...instance,
    props: { ...instance.props, ...propsOverride },
    style: style ?? instance.style,
  };
}

/** Секция-обёртка с готовыми детьми — почти каждый раздел шаблона это
 * `section` с одним содержательным блоком внутри (см. использование в
 * шаблонах), задаёт только фон/отступы, сам контент передаётся снаружи. */
export function section(children: WebsiteBlock[], style?: BlockStyle): WebsiteBlock {
  const instance = createBlockInstance('section', createBlockId());
  return { ...instance, style: style ?? instance.style, children };
}
