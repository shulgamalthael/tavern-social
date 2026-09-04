'use client';

import { useScrollReveal } from '../lib/use-scroll-reveal';
import { computeBlockWrapperStyle } from '../model/block-style';
import { type BlockBusinessContext, getBlockDefinition } from '../model/registry';
import { isBlockHidden } from '../model/resolve-responsive';
import type { Viewport, WebsiteBlock, WebsitePage, WebsiteTheme } from '../model/types';

export interface BlockRendererProps {
  block: WebsiteBlock;
  theme: WebsiteTheme;
  viewport: Viewport;
  business: BlockBusinessContext;
  /** Все страницы документа — см. комментарий `BlockRendererProps` (той, что
   * в `model/registry.ts` — это компонент-обёртка вокруг неё, не путать) —
   * нужны, только если у блока есть поле-ссылка на другую страницу сайта. */
  pages: WebsitePage[];
}

/**
 * Рекурсивный диспетчер: по `block.type` находит определение в реестре (см.
 * `model/registry.ts`) и рендерит его `Renderer`, оборачивая универсальными
 * отступами/фоном/шириной (`computeBlockWrapperStyle`, см. `model/block-
 * style.ts`). Контейнерные блоки получают своих детей уже отрендеренными
 * через `children` (сам блок не знает, как рекурсия работает — см.
 * `BlockDefinition.isContainer`).
 *
 * Чистый рендер без какой-либо редакторской логики (выделение/drag) — им
 * пользуются публичная страница и Preview. Канвас билдера (`widgets/
 * website-builder/ui/CanvasBlock.tsx`) рендерит те же блоки СВОИМ
 * компонентом (нужен drag&drop/тулбар выделения поверх каждого блока), но
 * через те же `getBlockDefinition`/`computeBlockWrapperStyle`, что и этот
 * файл — расчёт стилей не дублируется, только сама разметка-обёртка разная
 * (см. корневой план фичи, «Preview должен использовать тот же renderer,
 * что и публичная страница» — в билдере это тот же `Renderer` блока, тот
 * же `computeBlockWrapperStyle`, просто больше хрома вокруг).
 */
export function BlockRenderer({ block, theme, viewport, business, pages }: BlockRendererProps) {
  // Хук — ДО любых условных `return null` ниже (Rules of Hooks: `hidden`
  // может стать/перестать быть true между рендерами того же блока при
  // смене вьюпорта, пропуск вызова хука в части рендеров недопустим).
  // Деструктурируется сразу в отдельные переменные, не хранится как единый
  // объект `reveal.ref`/`reveal.style` — React Compiler иначе считает ЛЮБОЕ
  // чтение поля объекта, чьё другое поле уходит в JSX `ref=`, «чтением рефа
  // во время рендера» (см. комментарий `useScrollReveal`), даже для полей,
  // которые рефом не являются.
  const { ref: revealRef, style: revealStyle } = useScrollReveal(
    block.style?.entranceAnimation,
    block.style?.entranceDelay,
  );

  const definition = getBlockDefinition(block.type);
  if (!definition) return null;
  if (isBlockHidden(block, viewport)) return null;

  const { outer, inner, layout } = computeBlockWrapperStyle(block.style, viewport);
  const Renderer = definition.Renderer;

  return (
    <div ref={revealRef} style={{ ...outer, ...revealStyle }}>
      <div style={inner}>
        <Renderer
          props={block.props}
          theme={theme}
          viewport={viewport}
          business={business}
          pages={pages}
          layout={layout}
        >
          {definition.isContainer &&
            (block.children ?? []).map((child) => (
              <BlockRenderer
                key={child.id}
                block={child}
                theme={theme}
                viewport={viewport}
                business={business}
                pages={pages}
              />
            ))}
        </Renderer>
      </div>
    </div>
  );
}
