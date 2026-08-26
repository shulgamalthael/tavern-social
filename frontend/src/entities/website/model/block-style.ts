import type { CSSProperties } from 'react';
import { SPACING_PX } from './theme-tokens';
import type { Background, BlockStyle, ContainerWidth } from './types';

const FIXED_CONTAINER_WIDTH: Partial<Record<ContainerWidth, string>> = {
  narrow: '640px',
  wide: '1320px',
  full: 'none',
};

function backgroundValue(background: Background | undefined): string | undefined {
  switch (background) {
    case 'surface':
      return 'var(--site-surface)';
    case 'muted':
      return 'color-mix(in srgb, var(--site-border) 45%, var(--site-bg))';
    case 'primary':
      return 'var(--site-primary)';
    case 'dark':
      return 'var(--site-secondary)';
    default:
      return undefined;
  }
}

/** На тёмном/акцентном фоне `--site-text`/`--site-muted` часто сами
 * тёмные — переопределяем сами переменные на обёртке, любой вложенный блок,
 * который просто читает `var(--site-text)`, автоматически получает
 * светлый вариант, ничего не зная о фоне снаружи (см. `BlockRenderer.tsx`,
 * откуда этот модуль вынесен). */
function contrastOverrides(background: Background | undefined): CSSProperties | undefined {
  if (background !== 'primary' && background !== 'dark') return undefined;
  return {
    '--site-text': '#ffffff',
    '--site-muted': 'rgba(255, 255, 255, 0.72)',
    '--site-border': 'rgba(255, 255, 255, 0.22)',
  } as CSSProperties;
}

export interface BlockWrapperStyle {
  outer: CSSProperties;
  inner: CSSProperties;
}

/**
 * Универсальные отступы/фон/ширина блока (`BlockStyle`, см. `types.ts`) →
 * инлайн-стили — общая точка для ЛЮБОГО места, которое оборачивает
 * рендерер блока: публичной страницы/Preview (`BlockRenderer.tsx`) и
 * канваса билдера (`widgets/website-builder/ui/CanvasBlock.tsx`). Вынесено
 * отдельно от `BlockRenderer`, потому что канвасу нужна СОВСЕМ другая
 * структура обёртки вокруг того же расчёта стилей (drag-хендл, тулбар
 * выделения) — дублировать саму математику отступов/фона в двух местах
 * означало бы риск, что они разъедутся при следующей правке одной из них.
 */
export function computeBlockWrapperStyle(style: BlockStyle | undefined): BlockWrapperStyle {
  const blockStyle = style ?? {};
  const maxWidth = blockStyle.maxWidth ?? 'default';

  const outer: CSSProperties = {
    background: backgroundValue(blockStyle.background),
    paddingTop: blockStyle.paddingY ? SPACING_PX[blockStyle.paddingY] : undefined,
    paddingBottom: blockStyle.paddingY ? SPACING_PX[blockStyle.paddingY] : undefined,
    marginTop: blockStyle.marginTop ? SPACING_PX[blockStyle.marginTop] : undefined,
    marginBottom: blockStyle.marginBottom ? SPACING_PX[blockStyle.marginBottom] : undefined,
    ...contrastOverrides(blockStyle.background),
  };

  const inner: CSSProperties = {
    maxWidth:
      maxWidth === 'default' ? 'var(--site-container-width)' : FIXED_CONTAINER_WIDTH[maxWidth],
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: blockStyle.paddingX ? SPACING_PX[blockStyle.paddingX] : undefined,
    paddingRight: blockStyle.paddingX ? SPACING_PX[blockStyle.paddingX] : undefined,
    textAlign: blockStyle.textAlign,
  };

  return { outer, inner };
}
