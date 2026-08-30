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

export type StyleFieldKey =
  'background' | 'paddingY' | 'paddingX' | 'marginTop' | 'marginBottom' | 'textAlign' | 'maxWidth';

const STYLE_FIELDS: Record<StyleFieldKey, readonly string[]> = {
  background: ['none', 'surface', 'muted', 'primary', 'dark'],
  paddingY: ['none', 'sm', 'md', 'lg', 'xl'],
  paddingX: ['none', 'sm', 'md', 'lg', 'xl'],
  marginTop: ['none', 'sm', 'md', 'lg', 'xl'],
  marginBottom: ['none', 'sm', 'md', 'lg', 'xl'],
  textAlign: ['left', 'center', 'right'],
  maxWidth: ['narrow', 'default', 'wide', 'full'],
};

export const STYLE_FIELD_KEYS = Object.keys(STYLE_FIELDS) as StyleFieldKey[];

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

    if (typeof value !== 'string' || !STYLE_FIELDS[key].includes(value)) {
      throw new Error(
        `Поле "${key}" должно быть одним из: ${STYLE_FIELDS[key].join(', ')} (или null, чтобы убрать)`,
      );
    }
    result[key] = value;
  }

  return result;
}
