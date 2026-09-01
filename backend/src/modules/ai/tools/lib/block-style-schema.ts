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
  'background' | 'paddingY' | 'paddingX' | 'marginTop' | 'marginBottom' | 'textAlign' | 'maxWidth';

/** Свободный hex вместо фиксированного набора значений (см.
 * `customBackgroundColor`/`gradientFrom`/`gradientTo` в `BlockStyle`,
 * `frontend/src/entities/website/model/types.ts`) — валидируются одной веткой
 * в `buildValidatedStyle` (регекспом `HEX_COLOR_RE`, литеральным сравнением
 * ключа, а не через `ENUM_STYLE_FIELDS` — так TS сужает тип `key` после
 * `continue`, чего не сделал бы `Set.has()`). */
export type StyleFieldKey =
  | EnumStyleFieldKey
  | 'customBackgroundColor'
  | 'gradientFrom'
  | 'gradientTo'
  | 'gradientAngle'
  | 'gradientType';

const GRADIENT_TYPE_VALUES = ['linear', 'radial'] as const;

const ENUM_STYLE_FIELDS: Record<EnumStyleFieldKey, readonly string[]> = {
  background: ['none', 'surface', 'muted', 'primary', 'dark', 'custom', 'gradient'],
  paddingY: ['none', 'sm', 'md', 'lg', 'xl'],
  paddingX: ['none', 'sm', 'md', 'lg', 'xl'],
  marginTop: ['none', 'sm', 'md', 'lg', 'xl'],
  marginBottom: ['none', 'sm', 'md', 'lg', 'xl'],
  textAlign: ['left', 'center', 'right'],
  maxWidth: ['narrow', 'default', 'wide', 'full'],
};

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
]);

/** Upper bound for a custom pixel spacing value — generous enough for any
 * real layout need, but bounded rather than accepting literally any number:
 * AI-authored input is untrusted (`AI_PLATFORM_ROADMAP.md` §3), and an
 * unbounded value could push a block's spacing far enough to visually break
 * the page (e.g. a many-thousand-pixel margin). */
const MAX_CUSTOM_SPACING_PX = 400;

export const STYLE_FIELD_KEYS: StyleFieldKey[] = [
  ...(Object.keys(ENUM_STYLE_FIELDS) as EnumStyleFieldKey[]),
  'customBackgroundColor',
  'gradientFrom',
  'gradientTo',
  'gradientAngle',
  'gradientType',
];

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
    (key) => !STYLE_FIELD_KEYS.includes(key as StyleFieldKey),
  );
  if (unknownKeys.length > 0) {
    throw new Error(
      `Неизвестные поля стиля: ${unknownKeys.join(', ')}. Допустимые поля: ${STYLE_FIELD_KEYS.join(', ')}`,
    );
  }

  const result: Record<string, unknown> = { ...existingStyle };

  for (const key of STYLE_FIELD_KEYS) {
    if (!(key in input)) continue;
    const value = input[key];

    if (value === null) {
      delete result[key];
      continue;
    }

    if (key === 'customBackgroundColor' || key === 'gradientFrom' || key === 'gradientTo') {
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
