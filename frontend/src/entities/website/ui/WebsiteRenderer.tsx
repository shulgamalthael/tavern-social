'use client';

import type { CSSProperties } from 'react';
import { cn } from '@/shared/lib/cn';
import type { BlockBusinessContext } from '../model/registry';
import { buildThemeCssVars } from '../model/theme-tokens';
import type { Viewport, WebsitePage, WebsiteTheme } from '../model/types';
import { BlockRenderer } from './BlockRenderer';
import styles from './WebsiteRenderer.module.scss';

export interface WebsiteRendererProps {
  page: WebsitePage;
  theme: WebsiteTheme;
  viewport: Viewport;
  business: BlockBusinessContext;
  className?: string;
  /** Все страницы документа, не только рендеримая `page` — нужны блокам с
   * полем-ссылкой на другую страницу сайта (`control: 'link'`, см.
   * `resolve-link.ts`). По умолчанию `[page]` — сама рендеримая страница —
   * так вызывающему не обязательно знать про весь документ, если ссылок на
   * ДРУГИЕ страницы в его случае не бывает (например, `PreviewModal.tsx`
   * сейчас превьюит одну страницу за раз, см. её комментарий). */
  pages?: WebsitePage[];
}

/**
 * Единственная точка входа для отображения готового сайта — Preview и
 * публичная страница бизнеса вызывают ровно этот компонент с одним и тем
 * же документом (см. корневой план фичи, «Preview должен использовать тот
 * же renderer, что и публичная страница»). Канвас билдера показывает то же
 * дерево блоков своим компонентом с редакторским хромом поверх (см.
 * `widgets/website-builder/ui/Canvas.tsx`), но через те же
 * `getBlockDefinition`/`computeBlockWrapperStyle`, что и `BlockRenderer`
 * здесь — сам рендер блока не дублируется.
 *
 * Тема кладётся в CSS custom properties на этой обёртке (`buildThemeCssVars`)
 * — весь рендер блоков ниже читает только `--site-*`, поэтому смена темы в
 * инспекторе применяется мгновенно перерисовкой стилей, без необходимости
 * перерендеривать сами блоки.
 */
export function WebsiteRenderer({
  page,
  theme,
  viewport,
  business,
  className,
  pages,
}: WebsiteRendererProps) {
  const themeVars = buildThemeCssVars(theme) as CSSProperties;
  const resolvedPages = pages ?? [page];

  return (
    <div className={cn(styles.website, className)} style={themeVars}>
      {page.blocks.map((block) => (
        <BlockRenderer
          key={block.id}
          block={block}
          theme={theme}
          viewport={viewport}
          business={business}
          pages={resolvedPages}
        />
      ))}
    </div>
  );
}
