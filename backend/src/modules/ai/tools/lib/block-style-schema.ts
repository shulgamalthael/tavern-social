/**
 * Валидатор `set_style` — в отличие от `props` (разные у каждого типа
 * блока, см. `add-block-schemas.ts`), `style` СТРУКТУРНО ОДИНАКОВ для
 * ЛЮБОГО блока (`BlockStyle` в `frontend/src/entities/website/model/
 * types.ts`) — поэтому `set_style`, в отличие от `update_block_props`, не
 * ограничен curated allowlist типов блоков, а работает на блоке любого типа.
 *
 * Намеренно НЕ покрывает весь `BlockStyle`:
 * - Только «простой» режим (`background`/`paddingY`/`paddingX`/`marginTop`/
 *   `marginBottom`/`textAlign`/`maxWidth`) — без режима «Дополнительно»
 *   (`customPadding` + `paddingTop`/`Right`/`Bottom`/`Left`, см. комментарий
 *   `BlockStyle.customPadding` в `types.ts`): те 4 поля игнорируются
 *   рендерером ПОКА `customPadding` не `true` (`resolveSide` в `frontend/
 *   src/entities/website/model/block-style.ts`), а включать сам флаг через
 *   AI без явного запроса на независимые отступы по сторонам — больше
 *   риска запутать пользователя, чем пользы; не построено намеренно, не
 *   пропущено по ошибке.
 * - Только плоские (не `ResponsiveValue<T>`) значения — тот же осознанный
 *   выбор, что уже сделан для `heading.size` в `add-block-schemas.ts`:
 *   `readResponsiveProp` трактует плоское значение как «на всех вьюпортах»,
 *   это штатный путь без деградации, просто без per-viewport override.
 */

export type EnumStyleFieldKey =
  | 'background'
  | 'paddingY'
  | 'paddingX'
  | 'marginTop'
  | 'marginBottom'
  | 'textAlign'
  | 'maxWidth'
  | 'borderWidth'
  | 'shadow'
  | 'display'
  | 'direction'
  | 'justify'
  | 'align'
  | 'gap'
  | 'grow'
  | 'entranceAnimation';

/** Числовые (не enum) поля раскладки — `gridColumns`/`fixedWidth`/
 * `stickyOffset`/`entranceDelay` не сводятся к именованному набору значений,
 * у каждого своя граница диапазона (см. `NUMBER_STYLE_FIELD_BOUNDS`). */
export type NumberStyleFieldKey = 'gridColumns' | 'fixedWidth' | 'stickyOffset' | 'entranceDelay';

/** Булевы поля раскладки/позиции — `wrap`/`sticky`, единственный вид поля в
 * этом валидаторе, который принимает `true`/`false`, а не строку/число/hex. */
export type BooleanStyleFieldKey = 'wrap' | 'sticky';

/** Свободный hex вместо фиксированного набора значений (см.
 * `customBackgroundColor`/`gradientFrom`/`gradientTo` в `BlockStyle`,
 * `frontend/src/entities/website/model/types.ts`) — валидируются одной веткой
 * в `buildValidatedStyle` (регекспом `HEX_COLOR_RE`, литеральным сравнением
 * ключа, а не через `ENUM_STYLE_FIELDS` — так TS сужает тип `key` после
 * `continue`, чего не сделал бы `Set.has()`). */
export type StyleFieldKey =
  | EnumStyleFieldKey
  | NumberStyleFieldKey
  | BooleanStyleFieldKey
  | 'customBackgroundColor'
  | 'gradientFrom'
  | 'gradientTo'
  | 'gradientAngle'
  | 'gradientType'
  | 'textColor'
  | 'borderColor';

const GRADIENT_TYPE_VALUES = ['linear', 'radial'] as const;

const ENUM_STYLE_FIELDS: Record<EnumStyleFieldKey, readonly string[]> = {
  background: ['none', 'surface', 'muted', 'primary', 'dark', 'custom', 'gradient'],
  paddingY: ['none', 'sm', 'md', 'lg', 'xl'],
  paddingX: ['none', 'sm', 'md', 'lg', 'xl'],
  marginTop: ['none', 'sm', 'md', 'lg', 'xl'],
  marginBottom: ['none', 'sm', 'md', 'lg', 'xl'],
  textAlign: ['left', 'center', 'right'],
  maxWidth: ['narrow', 'default', 'wide', 'full'],
  borderWidth: ['none', 'thin', 'medium', 'thick'],
  shadow: ['none', 'soft', 'medium', 'strong', 'floating'],
  display: ['block', 'flex', 'grid'],
  direction: ['row', 'column'],
  justify: ['start', 'center', 'end', 'space-between', 'space-around'],
  align: ['start', 'center', 'end', 'stretch'],
  gap: ['none', 'sm', 'md', 'lg', 'xl'],
  grow: ['grow', 'fixed'],
  entranceAnimation: [
    'none',
    'fade',
    'slide-up',
    'slide-down',
    'slide-left',
    'slide-right',
    'zoom-in',
  ],
};

/** Верхняя/нижняя граница каждого числового поля раскладки — тот же принцип,
 * что у `MAX_CUSTOM_SPACING_PX` ниже: AI-input untrusted, диапазон не даёт
 * значению визуально сломать страницу (0 колонок, ширина в тысячи px). */
const NUMBER_STYLE_FIELD_BOUNDS: Record<NumberStyleFieldKey, { min: number; max: number }> = {
  gridColumns: { min: 1, max: 6 },
  fixedWidth: { min: 20, max: 800 },
  stickyOffset: { min: 0, max: 400 },
  entranceDelay: { min: 0, max: 800 },
};

const BOOLEAN_STYLE_FIELDS: ReadonlySet<BooleanStyleFieldKey> = new Set(['wrap', 'sticky']);

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** `paddingY`/`paddingX`/`marginTop`/`marginBottom` also accept a plain
 * number (px) in addition to their 5-value enum above — see `SpacingValue`
 * in `frontend/src/entities/website/model/types.ts`. Only these 4: the
 * `customPadding`/per-side fields aren't in this tool's scope at all (see
 * the doc-comment above), so there's nothing else to widen. */
const SPACING_FIELD_KEYS = new Set<EnumStyleFieldKey>([
  'paddingY',
  'paddingX',
  'marginTop',
  'marginBottom',
  'gap',
]);

/** Upper bound for a custom pixel spacing value — generous enough for any
 * real layout need, but bounded rather than accepting literally any number:
 * AI-authored input is untrusted (`AI_PLATFORM_ROADMAP.md` §3), and an
 * unbounded value could push a block's spacing far enough to visually break
 * the page (e.g. a many-thousand-pixel margin). */
const MAX_CUSTOM_SPACING_PX = 400;

export const STYLE_FIELD_KEYS: StyleFieldKey[] = [
  ...(Object.keys(ENUM_STYLE_FIELDS) as EnumStyleFieldKey[]),
  ...(Object.keys(NUMBER_STYLE_FIELD_BOUNDS) as NumberStyleFieldKey[]),
  ...BOOLEAN_STYLE_FIELDS,
  'customBackgroundColor',
  'gradientFrom',
  'gradientTo',
  'gradientAngle',
  'gradientType',
  'textColor',
  'borderColor',
];

/**
 * "Продвинутый CSS" (AI_PLATFORM_ROADMAP.md §78) — ограниченная, явно
 * перечисленная "форточка" для дизайнов, которые не укладываются в закрытые
 * токены выше (наклон/поворот, произвольная форма, размытие/glass-эффект,
 * свободная тень/скругление). НЕ произвольный CSS: только эти 12 свойств,
 * каждое — отдельное значение через объект `style` React
 * (`computeBlockWrapperStyle`), никогда как текст в `<style>`/
 * `dangerouslySetInnerHTML` — структурно невозможно вставить новый
 * селектор/правило этим путём, что бы ни было в значении. `position`/`top`/
 * `right`/`bottom`/`left`/`zIndex` (риск для stacking/оверлея), `background`/
 * `backgroundImage` (уже свой токенный `background`/градиент выше — свободное
 * значение здесь было бы ровно тем способом, которым внешний
 * tracking-pixel/SSRF-подобный URL мог бы просочиться) и `content` (не
 * применимо вне псевдо-элементов, которых этот механизм не касается) —
 * НИКОГДА не допускаются, независимо от значения.
 */
export type AdvancedCssProperty =
  | 'transform'
  | 'clipPath'
  | 'filter'
  | 'backdropFilter'
  | 'mixBlendMode'
  | 'opacity'
  | 'borderRadius'
  | 'boxShadow'
  | 'letterSpacing'
  | 'textTransform'
  | 'fontStyle'
  | 'fontWeight';

export const ADVANCED_CSS_PROPERTIES: readonly AdvancedCssProperty[] = [
  'transform',
  'clipPath',
  'filter',
  'backdropFilter',
  'mixBlendMode',
  'opacity',
  'borderRadius',
  'boxShadow',
  'letterSpacing',
  'textTransform',
  'fontStyle',
  'fontWeight',
];

const ADVANCED_ENUM_VALUES: Partial<Record<AdvancedCssProperty, readonly string[]>> = {
  mixBlendMode: [
    'normal',
    'multiply',
    'screen',
    'overlay',
    'darken',
    'lighten',
    'color-dodge',
    'color-burn',
    'hard-light',
    'soft-light',
    'difference',
    'exclusion',
    'hue',
    'saturation',
    'color',
    'luminosity',
  ],
  textTransform: ['none', 'uppercase', 'lowercase', 'capitalize'],
  fontStyle: ['normal', 'italic', 'oblique'],
};

const MAX_ADVANCED_VALUE_LENGTH = 200;

/** Токенов из этого списка не бывает ни в одном ЛЕГИТИМНОМ значении этих 12
 * свойств — их присутствие означает только попытку инъекции внешнего
 * ресурса/разметки/новой CSS-конструкции, не случайный валидный ввод. */
const FORBIDDEN_VALUE_PATTERN = /url\(|expression\(|javascript:|@import|[;<>{}\\]/i;

/** "Свободные" (не enum/число) значения — `rotate(8deg)`, `polygon(0 0,
 * 100% 0, 100% 85%, 0 100%)`, `blur(4px) saturate(1.4)`, `0 12px 40px
 * rgba(0,0,0,.25)`, `2rem 0.5rem` и т. п. Набор символов покрывает реальную
 * грамматику этих свойств и структурно недостаточен, чтобы собрать новый
 * селектор/правило или внешний адрес. */
const SAFE_VALUE_CHARS_RE = /^[a-zA-Z0-9\s.,%+\-#()'/]*$/;

function sanitizeAdvancedCssValue(property: AdvancedCssProperty, rawValue: unknown): string {
  if (typeof rawValue !== 'string' || rawValue.length === 0) {
    throw new Error(
      `Поле "advanced.${property}" должно быть непустой строкой (или null, чтобы убрать)`,
    );
  }
  if (rawValue.length > MAX_ADVANCED_VALUE_LENGTH) {
    throw new Error(
      `Поле "advanced.${property}" не может быть длиннее ${MAX_ADVANCED_VALUE_LENGTH} символов`,
    );
  }
  if (FORBIDDEN_VALUE_PATTERN.test(rawValue)) {
    throw new Error(
      `Поле "advanced.${property}" содержит недопустимую конструкцию (url()/expression()/@import/спецсимволы) — только само значение CSS-свойства, без ссылок и вложенных правил`,
    );
  }

  const enumValues = ADVANCED_ENUM_VALUES[property];
  if (enumValues) {
    if (!enumValues.includes(rawValue)) {
      throw new Error(`Поле "advanced.${property}" должно быть одним из: ${enumValues.join(', ')}`);
    }
    return rawValue;
  }

  if (property === 'opacity') {
    const num = Number(rawValue);
    if (!Number.isFinite(num) || num < 0 || num > 1) {
      throw new Error(
        'Поле "advanced.opacity" должно быть числом от 0 до 1 строкой (например "0.8")',
      );
    }
    return rawValue;
  }

  if (property === 'fontWeight') {
    const num = Number(rawValue);
    const validNumeric = Number.isInteger(num) && num >= 100 && num <= 900 && num % 100 === 0;
    if (!validNumeric && rawValue !== 'normal' && rawValue !== 'bold') {
      throw new Error(
        'Поле "advanced.fontWeight" должно быть числом от 100 до 900 (шагом 100) или "normal"/"bold"',
      );
    }
    return rawValue;
  }

  if (!SAFE_VALUE_CHARS_RE.test(rawValue)) {
    throw new Error(
      `Поле "advanced.${property}" содержит недопустимые символы — разрешены только буквы/цифры/пробелы/. , % + - # ( ) ' /`,
    );
  }
  return rawValue;
}

/**
 * `advanced` — партиальный мёрж, как и весь остальной `buildValidatedStyle`
 * (`null` у конкретного CSS-свойства убирает именно его). Вызывается только
 * из `buildValidatedStyle` ниже, не экспортируется отдельно — тот же
 * "один вход" принцип, что и у остальных веток валидатора.
 */
function buildValidatedAdvancedStyle(
  existing: Record<string, unknown> | undefined,
  raw: unknown,
): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Поле "advanced" должно быть объектом');
  }
  const input = raw as Record<string, unknown>;

  const unknownKeys = Object.keys(input).filter(
    (key) => !ADVANCED_CSS_PROPERTIES.includes(key as AdvancedCssProperty),
  );
  if (unknownKeys.length > 0) {
    throw new Error(
      `Неизвестные поля advanced: ${unknownKeys.join(', ')}. Допустимые: ${ADVANCED_CSS_PROPERTIES.join(', ')}`,
    );
  }

  const result: Record<string, unknown> = { ...existing };
  for (const property of ADVANCED_CSS_PROPERTIES) {
    if (!(property in input)) continue;
    const value = input[property];
    if (value === null) {
      delete result[property];
      continue;
    }
    result[property] = sanitizeAdvancedCssValue(property, value);
  }
  return result;
}

/**
 * Мёржит валидированные изменения поверх текущего `style` блока (partial —
 * незатронутые поля не трогаются, тот же принцип, что у `buildValidatedProps`
 * в `add-block-schemas.ts`). `null` у конкретного поля значит «убрать это
 * поле совсем» (вернуть блок к дефолтному поведению рендерера для него), а
 * не «поставить значение null» — `BlockStyle`/`computeBlockWrapperStyle` не
 * знают состояния `null`, только «поле отсутствует». Незнакомый ключ или
 * значение вне перечисленного набора — бросает, не игнорирует молча (модель
 * — untrusted input, см. `AI_PLATFORM_ROADMAP.md` §3).
 */
export function buildValidatedStyle(
  existingStyle: Record<string, unknown> | undefined,
  rawStyle: unknown,
): Record<string, unknown> {
  if (typeof rawStyle !== 'object' || rawStyle === null) {
    throw new Error('style должен быть объектом');
  }
  const input = rawStyle as Record<string, unknown>;

  const unknownKeys = Object.keys(input).filter(
    (key) => key !== 'advanced' && !STYLE_FIELD_KEYS.includes(key as StyleFieldKey),
  );
  if (unknownKeys.length > 0) {
    throw new Error(
      `Неизвестные поля стиля: ${unknownKeys.join(', ')}. Допустимые поля: ${STYLE_FIELD_KEYS.join(', ')}, advanced`,
    );
  }

  const result: Record<string, unknown> = { ...existingStyle };

  // `advanced` — отдельная ветка ДО основного цикла: это не плоский
  // enum/число/hex-ключ, а вложенный объект своих собственных полей (см.
  // `buildValidatedAdvancedStyle`), не входящий в `STYLE_FIELD_KEYS`.
  if ('advanced' in input) {
    if (input.advanced === null) {
      delete result.advanced;
    } else {
      result.advanced = buildValidatedAdvancedStyle(
        existingStyle?.advanced as Record<string, unknown> | undefined,
        input.advanced,
      );
    }
  }

  for (const key of STYLE_FIELD_KEYS) {
    if (!(key in input)) continue;
    const value = input[key];

    if (value === null) {
      delete result[key];
      continue;
    }

    if (
      key === 'customBackgroundColor' ||
      key === 'gradientFrom' ||
      key === 'gradientTo' ||
      key === 'textColor' ||
      key === 'borderColor'
    ) {
      if (typeof value !== 'string' || !HEX_COLOR_RE.test(value)) {
        throw new Error(
          `Поле "${key}" должно быть hex-цветом вида #rrggbb (или null, чтобы убрать)`,
        );
      }
      result[key] = value;
      continue;
    }

    if (key === 'gradientAngle') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 360) {
        throw new Error(
          `Поле "gradientAngle" должно быть числом от 0 до 360 (или null, чтобы убрать)`,
        );
      }
      result[key] = value;
      continue;
    }

    if (key === 'gradientType') {
      if (
        typeof value !== 'string' ||
        !GRADIENT_TYPE_VALUES.includes(value as 'linear' | 'radial')
      ) {
        throw new Error(
          `Поле "gradientType" должно быть одним из: ${GRADIENT_TYPE_VALUES.join(', ')} (или null, чтобы убрать)`,
        );
      }
      result[key] = value;
      continue;
    }

    if (key === 'wrap' || key === 'sticky') {
      if (typeof value !== 'boolean') {
        throw new Error(`Поле "${key}" должно быть true/false (или null, чтобы убрать)`);
      }
      result[key] = value;
      continue;
    }

    if (
      key === 'gridColumns' ||
      key === 'fixedWidth' ||
      key === 'stickyOffset' ||
      key === 'entranceDelay'
    ) {
      const bounds = NUMBER_STYLE_FIELD_BOUNDS[key];
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < bounds.min ||
        value > bounds.max
      ) {
        throw new Error(
          `Поле "${key}" должно быть числом от ${bounds.min} до ${bounds.max} (или null, чтобы убрать)`,
        );
      }
      result[key] = value;
      continue;
    }

    if (SPACING_FIELD_KEYS.has(key) && typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0 || value > MAX_CUSTOM_SPACING_PX) {
        throw new Error(
          `Поле "${key}" как число (px) должно быть от 0 до ${MAX_CUSTOM_SPACING_PX} (или строкой из перечисленных значений, или null, чтобы убрать)`,
        );
      }
      result[key] = value;
      continue;
    }

    const allowed = ENUM_STYLE_FIELDS[key];
    if (typeof value !== 'string' || !allowed.includes(value)) {
      throw new Error(
        `Поле "${key}" должно быть одним из: ${allowed.join(', ')} (или null, чтобы убрать)`,
      );
    }
    result[key] = value;
  }

  return result;
}
