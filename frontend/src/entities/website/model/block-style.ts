import type { CSSProperties } from 'react';
import { readResponsiveProp } from './registry';
import { BLOCK_SHADOW_VALUE, BORDER_WIDTH_PX, SPACING_PX } from './theme-tokens';
import type {
  BlockStyle,
  ContainerWidth,
  LayoutDirection,
  SpacingValue,
  StyleValue,
  Viewport,
} from './types';

/** `SpacingValue` → CSS-длина — именованный пресет читает `SPACING_PX`
 * (`theme-tokens.ts`), число — произвольный px (см. `SpacingValue` в
 * `types.ts`). Возвращает `undefined` только для `undefined` на входе:
 * `0` — валидный custom-отступ и не должен схлопываться в «нет значения»
 * (`value ? ... : undefined` до этого инкремента ровно так и делал бы —
 * `0` ложно, `'none'` истинно только потому, что это непустая строка). */
function spacingToPx(value: SpacingValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : SPACING_PX[value];
}

const FIXED_CONTAINER_WIDTH: Partial<Record<ContainerWidth, string>> = {
  narrow: '640px',
  wide: '1320px',
  full: 'none',
};

const DEFAULT_GRADIENT_ANGLE = 135;

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
    case 'gradient':
      if (!blockStyle.gradientFrom || !blockStyle.gradientTo) return undefined;
      return blockStyle.gradientType === 'radial'
        ? `radial-gradient(circle, ${blockStyle.gradientFrom}, ${blockStyle.gradientTo})`
        : `linear-gradient(${blockStyle.gradientAngle ?? DEFAULT_GRADIENT_ANGLE}deg, ${blockStyle.gradientFrom}, ${blockStyle.gradientTo})`;
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
 * себя так же, как `dark`/`primary`, светлый произвольный — как обычно.
 * Для `gradient` — светлый текст только если ОБА цвета градиента тёмные
 * (консервативно: половина светлого/половина тёмного градиента визуально
 * неоднозначна для любого фиксированного выбора цвета текста, но
 * рисковать нечитаемым белым-на-белом хуже, чем нечитаемым тёмным-на-
 * тёмном участке — тот же принцип "безопаснее не переопределять при
 * сомнении", что и у `isDarkColor`'s фолбэка на `false`).
 *
 * `blockStyle.textColor` — явный выбор пользователя (см. её комментарий в
 * `types.ts`) — побеждает над всей эвристикой ниже: если человек сам
 * выбрал цвет текста для блока, не нужно гадать по яркости фона поверх
 * этого. Не трогает `--site-muted`/`--site-border` — это не полная замена
 * автоматического контраста, а только цвет основного текста. */
function contrastOverrides(blockStyle: BlockStyle): CSSProperties | undefined {
  if (blockStyle.textColor) {
    return { '--site-text': blockStyle.textColor } as CSSProperties;
  }

  const isDark =
    blockStyle.background === 'primary' ||
    blockStyle.background === 'dark' ||
    (blockStyle.background === 'custom' &&
      Boolean(blockStyle.customBackgroundColor) &&
      isDarkColor(blockStyle.customBackgroundColor as string)) ||
    (blockStyle.background === 'gradient' &&
      Boolean(blockStyle.gradientFrom) &&
      Boolean(blockStyle.gradientTo) &&
      isDarkColor(blockStyle.gradientFrom as string) &&
      isDarkColor(blockStyle.gradientTo as string));
  if (!isDark) return undefined;
  return {
    '--site-text': '#ffffff',
    '--site-muted': 'rgba(255, 255, 255, 0.72)',
    '--site-border': 'rgba(255, 255, 255, 0.22)',
  } as CSSProperties;
}

/** Рамка/тень ВСЕГО блока (AI_PLATFORM_ROADMAP.md §31) — отдельная
 * возможность от рамки/тени карточных поверхностей ВНУТРИ блока (та —
 * `--site-card-border-width`/`--site-card-shadow`, тема сайта, см.
 * `theme-tokens.ts`). Скругление ставим здесь же (`var(--site-radius)`),
 * когда активна рамка ИЛИ тень — так у блока с любой из них сразу
 * получается визуальный язык, согласованный с карточками сайта, без
 * отдельного per-block поля радиуса (узкий v1, см. её обоснование в
 * `types.ts`). */
function borderAndShadowStyle(blockStyle: BlockStyle): CSSProperties {
  const hasBorder = Boolean(blockStyle.borderWidth) && blockStyle.borderWidth !== 'none';
  const hasShadow = Boolean(blockStyle.shadow) && blockStyle.shadow !== 'none';

  return {
    border: hasBorder
      ? `${BORDER_WIDTH_PX[blockStyle.borderWidth as NonNullable<BlockStyle['borderWidth']>]} solid ${blockStyle.borderColor || 'var(--site-border)'}`
      : undefined,
    borderRadius: hasBorder || hasShadow ? 'var(--site-radius)' : undefined,
    boxShadow: hasShadow
      ? BLOCK_SHADOW_VALUE[blockStyle.shadow as NonNullable<BlockStyle['shadow']>]
      : undefined,
  };
}

export interface BlockWrapperStyle {
  outer: CSSProperties;
  inner: CSSProperties;
  /** Стиль раскладки САМОГО этого блока как контейнера для своих детей
   * (`display`/`flexDirection`/`gap`/... — см. `BlockStyle`'s раздел
   * «Раскладка» в `types.ts`) — в отличие от `outer`/`inner`, это не
   * обёртка ВОКРУГ блока, а стиль, который применяет НА СЕБЯ сам `Renderer`
   * контейнерного блока (`section`/`container`/`columns`,
   * `blocks/layout/index.tsx`) поверх своего SCSS-класса. Пустой объект
   * (`display` не задан/`'block'`) — старое поведение блока без изменений. */
  layout: CSSProperties;
}

const JUSTIFY_CONTENT: Record<NonNullable<BlockStyle['justify']>, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  'space-between': 'space-between',
  'space-around': 'space-around',
};

const ALIGN_ITEMS: Record<NonNullable<BlockStyle['align']>, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

/** Раскладка блока-контейнера для своих детей (`BlockWrapperStyle.layout`)
 * — `display: 'block'`/не задано оставляет объект пустым, ничего не
 * переопределяя поверх SCSS-класса блока (`layout.module.scss`), так
 * документы без этих полей выглядят ровно как раньше. */
function layoutStyle(blockStyle: BlockStyle, viewport: Viewport): CSSProperties {
  const display = readResponsiveProp<BlockStyle['display']>(blockStyle.display, viewport, 'block');
  if (!display || display === 'block') return {};

  const gap = spacingToPx(
    readResponsiveProp<SpacingValue | undefined>(blockStyle.gap, viewport, undefined),
  );
  const justifyContent = blockStyle.justify ? JUSTIFY_CONTENT[blockStyle.justify] : undefined;
  const alignItems = blockStyle.align ? ALIGN_ITEMS[blockStyle.align] : undefined;

  if (display === 'grid') {
    const columns = readResponsiveProp<number | undefined>(blockStyle.gridColumns, viewport, 3);
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap,
      justifyContent,
      alignItems,
    };
  }

  const direction = readResponsiveProp<LayoutDirection>(blockStyle.direction, viewport, 'row');

  return {
    display: 'flex',
    flexDirection: direction === 'column' ? 'column' : 'row',
    flexWrap: blockStyle.wrap ? 'wrap' : 'nowrap',
    gap,
    justifyContent,
    alignItems,
  };
}

/** Раскладка блока КАК РЕБЁНКА чужого flex/grid-ряда (`grow`/`fixedWidth`)
 * плюс `sticky` — оба идут на `outer` (см. `BlockRenderer.tsx`: `outer` —
 * самый внешний DOM-узел блока, то есть ровно тот, что становится flex/
 * grid-item'ом родителя). Безопасный no-op на любом родителе, который сам
 * не flex/grid — браузер просто игнорирует `flex`/`align-self` вне
 * flex/grid-контекста. */
function childLayoutStyle(blockStyle: BlockStyle): CSSProperties {
  const sizing: CSSProperties =
    blockStyle.grow === 'fixed' && blockStyle.fixedWidth
      ? { flex: `0 0 ${blockStyle.fixedWidth}px` }
      : blockStyle.grow === 'grow'
        ? { flex: '1 1 0%', minWidth: 0 }
        : {};

  const stickyStyle: CSSProperties = blockStyle.sticky
    ? { position: 'sticky', top: `${blockStyle.stickyOffset ?? 0}px`, alignSelf: 'flex-start' }
    : {};

  return { ...sizing, ...stickyStyle };
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
  raw: StyleValue<SpacingValue | null> | undefined,
  viewport: Viewport,
  customPadding: boolean | undefined,
  pairValue: SpacingValue | undefined,
): SpacingValue | undefined {
  if (!customPadding) return pairValue;
  return readResponsiveProp<SpacingValue | null>(raw, viewport, null) ?? pairValue;
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

  const paddingY = readResponsiveProp<SpacingValue | undefined>(
    blockStyle.paddingY,
    viewport,
    undefined,
  );
  const paddingX = readResponsiveProp<SpacingValue | undefined>(
    blockStyle.paddingX,
    viewport,
    undefined,
  );
  const marginTop = readResponsiveProp<SpacingValue | undefined>(
    blockStyle.marginTop,
    viewport,
    undefined,
  );
  const marginBottom = readResponsiveProp<SpacingValue | undefined>(
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
    ...childLayoutStyle(blockStyle),
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
    paddingTop: spacingToPx(top),
    paddingBottom: spacingToPx(bottom),
    marginTop: spacingToPx(marginTop),
    marginBottom: spacingToPx(marginBottom),
    ...borderAndShadowStyle(blockStyle),
    ...contrastOverrides(blockStyle),
  };

  const inner: CSSProperties = {
    maxWidth:
      maxWidth === 'default' ? 'var(--site-container-width)' : FIXED_CONTAINER_WIDTH[maxWidth],
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: spacingToPx(left),
    paddingRight: spacingToPx(right),
    textAlign: blockStyle.textAlign,
  };

  return { outer, inner, layout: layoutStyle(blockStyle, viewport) };
}
