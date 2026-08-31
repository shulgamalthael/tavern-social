import type { CSSProperties } from 'react';
import { readResponsiveProp } from './registry';
import { SPACING_PX } from './theme-tokens';
import type { BlockStyle, ContainerWidth, SpacingSize, StyleValue, Viewport } from './types';

const FIXED_CONTAINER_WIDTH: Partial<Record<ContainerWidth, string>> = {
  narrow: '640px',
  wide: '1320px',
  full: 'none',
};

function backgroundValue(blockStyle: BlockStyle): string | undefined {
  switch (blockStyle.background) {
    case 'surface':
      return 'var(--site-surface)';
    case 'muted':
      return 'color-mix(in srgb, var(--site-border) 45%, var(--site-bg))';
    case 'primary':
      return 'var(--site-primary)';
    case 'dark':
      return 'var(--site-secondary)';
    case 'custom':
      return blockStyle.customBackgroundColor || undefined;
    default:
      return undefined;
  }
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/;

/** Воспринимаемая яркость `#rrggbb` (формула YIQ) — `false`, если строка не
 * похожа на валидный hex-цвет: тогда `contrastOverrides` ничего не
 * переопределяет и текст остаётся тёмным по умолчанию, что безопаснее для
 * незаконченного/некорректного значения, чем угадывать белым. */
function isDarkColor(hex: string): boolean {
  const match = HEX_COLOR_RE.exec(hex);
  if (!match) return false;
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq < 140;
}

/** На тёмном/акцентном фоне `--site-text`/`--site-muted` часто сами
 * тёмные — переопределяем сами переменные на обёртке, любой вложенный блок,
 * который просто читает `var(--site-text)`, автоматически получает
 * светлый вариант, ничего не зная о фоне снаружи (см. `BlockRenderer.tsx`,
 * откуда этот модуль вынесен). Для `custom` цвета вместо фиксированного
 * списка фонов решает `isDarkColor` — тёмный произвольный цвет должен вести
 * себя так же, как `dark`/`primary`, светлый произвольный — как обычно. */
function contrastOverrides(blockStyle: BlockStyle): CSSProperties | undefined {
  const isDark =
    blockStyle.background === 'primary' ||
    blockStyle.background === 'dark' ||
    (blockStyle.background === 'custom' &&
      Boolean(blockStyle.customBackgroundColor) &&
      isDarkColor(blockStyle.customBackgroundColor as string));
  if (!isDark) return undefined;
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

/** Сторона отступа в режиме «Дополнительно» (`blockStyle.customPadding`,
 * см. её комментарий в `types.ts`) — `null` на этом вьюпорте значит
 * «взять то, во что уже разрешилась пара `paddingY`/`paddingX` НА ЭТОМ ЖЕ
 * вьюпорте» (`pairValue`), а не константу вроде `'none'`: иначе включение
 * тумблера «Дополнительно» без единой правки в новых полях внезапно обнулило
 * бы уже настроенные отступы. Когда тумблер выключен (обычный случай для
 * всех документов до этого инкремента), сторона всегда равна значению пары
 * — четыре новых поля просто не читаются вообще. */
function resolveSide(
  raw: StyleValue<SpacingSize | null> | undefined,
  viewport: Viewport,
  customPadding: boolean | undefined,
  pairValue: SpacingSize | undefined,
): SpacingSize | undefined {
  if (!customPadding) return pairValue;
  return readResponsiveProp<SpacingSize | null>(raw, viewport, null) ?? pairValue;
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
 *
 * `viewport` — реальный вьюпорт посетителя на публичном сайте
 * (`useRealViewport`) или симулированный вьюпорт канваса/Preview
 * (`store.viewport`) — тот же параметр, что уже принимает `Renderer`
 * каждого блока, теперь нужен и здесь: `paddingY`/`paddingX`/`marginTop`/
 * `marginBottom`/`maxWidth`/`paddingTop..Left` могут быть responsive
 * (`StyleValue<T>`, см. `types.ts`), разрешаются тем же
 * `readResponsiveProp`, что и responsive-поля `props` блоков.
 */
export function computeBlockWrapperStyle(
  style: BlockStyle | undefined,
  viewport: Viewport,
): BlockWrapperStyle {
  const blockStyle = style ?? {};

  const paddingY = readResponsiveProp<SpacingSize | undefined>(
    blockStyle.paddingY,
    viewport,
    undefined,
  );
  const paddingX = readResponsiveProp<SpacingSize | undefined>(
    blockStyle.paddingX,
    viewport,
    undefined,
  );
  const marginTop = readResponsiveProp<SpacingSize | undefined>(
    blockStyle.marginTop,
    viewport,
    undefined,
  );
  const marginBottom = readResponsiveProp<SpacingSize | undefined>(
    blockStyle.marginBottom,
    viewport,
    undefined,
  );
  const maxWidth = readResponsiveProp<ContainerWidth>(blockStyle.maxWidth, viewport, 'default');

  const top = resolveSide(blockStyle.paddingTop, viewport, blockStyle.customPadding, paddingY);
  const right = resolveSide(blockStyle.paddingRight, viewport, blockStyle.customPadding, paddingX);
  const bottom = resolveSide(
    blockStyle.paddingBottom,
    viewport,
    blockStyle.customPadding,
    paddingY,
  );
  const left = resolveSide(blockStyle.paddingLeft, viewport, blockStyle.customPadding, paddingX);

  const outer: CSSProperties = {
    background: backgroundValue(blockStyle),
    // Переобъявляем `color` тем же `--site-text`, что уже наследовался бы и
    // без этой строки НА САМОМ ДЕЛЕ ЖЕ ЗНАЧЕНИИ — но `color: inherit` внутри
    // конкретного блока (напр. `.hero__heading` в `business.module.scss`)
    // иначе наследует уже вычисленный на корне `WebsiteRenderer` цвет, а не
    // переменную заново: `contrastOverrides` ниже переопределяет саму
    // переменную `--site-text` на ЭТОЙ обёртке для тёмного/акцентного/своего
    // фона, но без повторного `color: var(...)` здесь у любого потомка с
    // `color: inherit` (а не прямым `color: var(--site-text)`) остался бы
    // старый тёмный цвет поверх тёмного фона — найдено живым тестом `hero`
    // блока с `background: 'custom'` на тёмном цвете.
    color: 'var(--site-text)',
    paddingTop: top ? SPACING_PX[top] : undefined,
    paddingBottom: bottom ? SPACING_PX[bottom] : undefined,
    marginTop: marginTop ? SPACING_PX[marginTop] : undefined,
    marginBottom: marginBottom ? SPACING_PX[marginBottom] : undefined,
    ...contrastOverrides(blockStyle),
  };

  const inner: CSSProperties = {
    maxWidth:
      maxWidth === 'default' ? 'var(--site-container-width)' : FIXED_CONTAINER_WIDTH[maxWidth],
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: left ? SPACING_PX[left] : undefined,
    paddingRight: right ? SPACING_PX[right] : undefined,
    textAlign: blockStyle.textAlign,
  };

  return { outer, inner };
}
