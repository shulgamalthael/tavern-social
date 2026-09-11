/**
 * Валидатор `set_theme` (AI_PLATFORM_ROADMAP.md §78) — та же роль для
 * `WebsiteTheme`, что `block-style-schema.ts` играет для `BlockStyle`:
 * `UpdateWebsiteDocumentDto.theme` (`websites/dto/update-website-document.dto.ts`)
 * НАМЕРЕННО провалидирован только как "объект" — правильно для человека,
 * редактирующего свой же сайт через доверенный браузер (см. её собственный
 * комментарий: правка темы не должна требовать правки backend-DTO), но
 * НЕБЕЗОПАСНО отдавать напрямую AI-инструменту без реальной проверки —
 * тот же принцип untrusted-input, что и у `buildValidatedProps`/
 * `buildValidatedStyle` (`AGENTS.md` §3).
 *
 * Backend держит СВОЮ независимую копию значений `FontChoice`/`GoogleFontId`/
 * `ThemeRadius`/`ButtonStyle`/`SectionSpacing`/`ThemeCardBorder`/
 * `ThemeCardShadow` (frontend `entities/website/model/types.ts`/
 * `google-fonts.ts`) — тот же приём "две независимые копии одного контракта",
 * что и у `ad-placement-config.ts`/`WIDGET_BLOCK_SCHEMAS`: backend не
 * импортирует frontend-код.
 */

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const COLOR_KEYS = [
  'primary',
  'secondary',
  'background',
  'surface',
  'text',
  'muted',
  'border',
] as const;

const FONT_CHOICE_VALUES = [
  'display-serif',
  'ui-sans',
  'mono',
  'rounded',
  'classic-serif',
  'google',
] as const;

/** Тот же курируемый список, что и frontend's `GoogleFontId`
 * (`entities/website/model/google-fonts.ts`) — сверено 1:1 на момент
 * написания, обновлять оба места синхронно при расширении списка. */
const GOOGLE_FONT_ID_VALUES = [
  'inter',
  'playfair-display',
  'poppins',
  'montserrat',
  'lora',
  'space-grotesk',
  'dm-sans',
  'merriweather',
  'bebas-neue',
  'roboto',
] as const;

const THEME_RADIUS_VALUES = ['none', 'sm', 'md', 'lg', 'full'] as const;
const BUTTON_STYLE_VALUES = ['solid', 'outline', 'soft'] as const;
const CONTAINER_WIDTH_VALUES = ['default', 'wide'] as const;
const SECTION_SPACING_VALUES = ['compact', 'comfortable', 'spacious'] as const;
const CARD_BORDER_VALUES = ['none', 'hairline', 'bold'] as const;
const CARD_SHADOW_VALUES = ['none', 'sm', 'md'] as const;

const THEME_TOP_LEVEL_KEYS = [
  'colors',
  'fonts',
  'radius',
  'buttonStyle',
  'containerWidth',
  'sectionSpacing',
  'cardBorder',
  'cardShadow',
] as const;

function validateHexColor(field: string, value: unknown): string {
  if (typeof value !== 'string' || !HEX_COLOR_RE.test(value)) {
    throw new Error(`Поле "${field}" должно быть hex-цветом вида #rrggbb`);
  }
  return value;
}

function validateEnum(field: string, value: unknown, allowed: readonly string[]): string {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(`Поле "${field}" должно быть одним из: ${allowed.join(', ')}`);
  }
  return value;
}

/**
 * Мёржит валидированные изменения поверх текущей `theme` сайта — партиально,
 * незатронутые поля не трогаются (тот же принцип, что у `buildValidatedStyle`).
 * `colors`/`fonts.heading`/`fonts.body`/`radius`/`buttonStyle`/
 * `containerWidth`/`sectionSpacing` обязательны у `WebsiteTheme` — `null` для
 * них не поддерживается (нечем заменить обязательное поле темы). Только
 * `fonts.googleFontHeading`/`fonts.googleFontBody`/`cardBorder`/`cardShadow`
 * (опциональные в `WebsiteTheme`) принимают `null` — убирает поле совсем,
 * рендерер откатывается на дефолт (см. их комментарий в `types.ts`).
 */
export function buildValidatedTheme(
  existingTheme: Record<string, unknown> | undefined,
  rawTheme: unknown,
): Record<string, unknown> {
  if (typeof rawTheme !== 'object' || rawTheme === null) {
    throw new Error('theme должен быть объектом');
  }
  const input = rawTheme as Record<string, unknown>;

  const unknownKeys = Object.keys(input).filter(
    (key) => !THEME_TOP_LEVEL_KEYS.includes(key as (typeof THEME_TOP_LEVEL_KEYS)[number]),
  );
  if (unknownKeys.length > 0) {
    throw new Error(
      `Неизвестные поля темы: ${unknownKeys.join(', ')}. Допустимые: ${THEME_TOP_LEVEL_KEYS.join(', ')}`,
    );
  }

  const result: Record<string, unknown> = {
    ...existingTheme,
    colors: { ...(existingTheme?.colors as Record<string, unknown> | undefined) },
    fonts: { ...(existingTheme?.fonts as Record<string, unknown> | undefined) },
  };

  if (input.colors !== undefined) {
    if (typeof input.colors !== 'object' || input.colors === null) {
      throw new Error('Поле "colors" должно быть объектом');
    }
    const colorsInput = input.colors as Record<string, unknown>;
    const unknownColorKeys = Object.keys(colorsInput).filter(
      (key) => !COLOR_KEYS.includes(key as (typeof COLOR_KEYS)[number]),
    );
    if (unknownColorKeys.length > 0) {
      throw new Error(
        `Неизвестные поля colors: ${unknownColorKeys.join(', ')}. Допустимые: ${COLOR_KEYS.join(', ')}`,
      );
    }
    const colorsResult = result.colors as Record<string, unknown>;
    for (const key of COLOR_KEYS) {
      if (key in colorsInput) {
        colorsResult[key] = validateHexColor(`colors.${key}`, colorsInput[key]);
      }
    }
  }

  if (input.fonts !== undefined) {
    if (typeof input.fonts !== 'object' || input.fonts === null) {
      throw new Error('Поле "fonts" должно быть объектом');
    }
    const fontsInput = input.fonts as Record<string, unknown>;
    const allowedFontKeys = ['heading', 'body', 'googleFontHeading', 'googleFontBody'] as const;
    const unknownFontKeys = Object.keys(fontsInput).filter(
      (key) => !allowedFontKeys.includes(key as (typeof allowedFontKeys)[number]),
    );
    if (unknownFontKeys.length > 0) {
      throw new Error(
        `Неизвестные поля fonts: ${unknownFontKeys.join(', ')}. Допустимые: ${allowedFontKeys.join(', ')}`,
      );
    }
    const fontsResult = result.fonts as Record<string, unknown>;
    if ('heading' in fontsInput) {
      fontsResult.heading = validateEnum('fonts.heading', fontsInput.heading, FONT_CHOICE_VALUES);
    }
    if ('body' in fontsInput) {
      fontsResult.body = validateEnum('fonts.body', fontsInput.body, FONT_CHOICE_VALUES);
    }
    if ('googleFontHeading' in fontsInput) {
      if (fontsInput.googleFontHeading === null) {
        delete fontsResult.googleFontHeading;
      } else {
        fontsResult.googleFontHeading = validateEnum(
          'fonts.googleFontHeading',
          fontsInput.googleFontHeading,
          GOOGLE_FONT_ID_VALUES,
        );
      }
    }
    if ('googleFontBody' in fontsInput) {
      if (fontsInput.googleFontBody === null) {
        delete fontsResult.googleFontBody;
      } else {
        fontsResult.googleFontBody = validateEnum(
          'fonts.googleFontBody',
          fontsInput.googleFontBody,
          GOOGLE_FONT_ID_VALUES,
        );
      }
    }
  }

  if ('radius' in input) result.radius = validateEnum('radius', input.radius, THEME_RADIUS_VALUES);
  if ('buttonStyle' in input) {
    result.buttonStyle = validateEnum('buttonStyle', input.buttonStyle, BUTTON_STYLE_VALUES);
  }
  if ('containerWidth' in input) {
    result.containerWidth = validateEnum(
      'containerWidth',
      input.containerWidth,
      CONTAINER_WIDTH_VALUES,
    );
  }
  if ('sectionSpacing' in input) {
    result.sectionSpacing = validateEnum(
      'sectionSpacing',
      input.sectionSpacing,
      SECTION_SPACING_VALUES,
    );
  }
  if ('cardBorder' in input) {
    if (input.cardBorder === null) delete result.cardBorder;
    else result.cardBorder = validateEnum('cardBorder', input.cardBorder, CARD_BORDER_VALUES);
  }
  if ('cardShadow' in input) {
    if (input.cardShadow === null) delete result.cardShadow;
    else result.cardShadow = validateEnum('cardShadow', input.cardShadow, CARD_SHADOW_VALUES);
  }

  return result;
}

export const THEME_COLOR_KEYS = COLOR_KEYS;
export const THEME_FONT_CHOICE_VALUES = FONT_CHOICE_VALUES;
export const THEME_GOOGLE_FONT_ID_VALUES = GOOGLE_FONT_ID_VALUES;
export const THEME_RADIUS_ALLOWED_VALUES = THEME_RADIUS_VALUES;
export const THEME_BUTTON_STYLE_VALUES = BUTTON_STYLE_VALUES;
export const THEME_CONTAINER_WIDTH_VALUES = CONTAINER_WIDTH_VALUES;
export const THEME_SECTION_SPACING_VALUES = SECTION_SPACING_VALUES;
export const THEME_CARD_BORDER_VALUES = CARD_BORDER_VALUES;
export const THEME_CARD_SHADOW_VALUES = CARD_SHADOW_VALUES;
