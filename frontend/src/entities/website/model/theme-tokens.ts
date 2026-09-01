import { googleFontFamily, type GoogleFontId } from './google-fonts';
import type {
  Background,
  BlockStyle,
  ButtonStyle,
  ContainerWidth,
  FontChoice,
  SectionSpacing,
  SpacingSize,
  TextAlign,
  ThemeCardBorder,
  ThemeCardShadow,
  ThemeRadius,
  WebsiteTheme,
} from './types';

/** Системные шрифтовые стеки — без загрузки веб-шрифтов (ноль лишних
 * запросов, ноль FOUT, ноль лицензионных вопросов). `'google'` — не системный
 * стек, у него нет записи здесь — см. `resolveFontStack` ниже, которая
 * подставляет реальный Google Font по `GoogleFontId` вместо чтения этой
 * таблицы для того случая. */
const FONT_STACKS: Record<Exclude<FontChoice, 'google'>, string> = {
  'display-serif': `Georgia, 'Times New Roman', serif`,
  'ui-sans': `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
  mono: `'SFMono-Regular', Consolas, 'Liberation Mono', monospace`,
  rounded: `Verdana, 'Trebuchet MS', sans-serif`,
  'classic-serif': `'Times New Roman', Times, serif`,
};

/** `choice === 'google'` без `googleFontId` (ещё не выбрали конкретный шрифт
 * из списка) — фолбэк на `'ui-sans'`, не на пустую строку: тот же принцип,
 * что и `backgroundValue` в `block-style.ts` — незаконченный custom-выбор не
 * должен ломать рендер, просто временно выглядит как дефолт. */
function resolveFontStack(choice: FontChoice, googleFontId: GoogleFontId | undefined): string {
  if (choice === 'google') {
    return googleFontId ? googleFontFamily(googleFontId) : FONT_STACKS['ui-sans'];
  }
  return FONT_STACKS[choice];
}

const RADIUS_PX: Record<ThemeRadius, string> = {
  none: '0px',
  sm: '4px',
  md: '10px',
  lg: '18px',
  full: '999px',
};

const CONTAINER_WIDTH_PX: Record<WebsiteTheme['containerWidth'], string> = {
  default: '1100px',
  wide: '1320px',
};

const SECTION_SPACING_PX: Record<SectionSpacing, string> = {
  compact: '32px',
  comfortable: '64px',
  spacious: '96px',
};

/** `hairline` (`1px`) — фолбэк по умолчанию, тот же захардкоженный `1px`,
 * что раньше был единственным значением у `.icon-card`/`.people-card`/
 * `.simple-card` (см. комментарий `ThemeCardBorder` в `types.ts`) — старые
 * документы без этого поля в `theme` (созданные до Phase 11) должны
 * выглядеть ровно так же, как выглядели раньше, а не внезапно потерять
 * рамку карточек. */
const CARD_BORDER_PX: Record<ThemeCardBorder, string> = {
  none: '0px',
  hairline: '1px',
  bold: '2px',
};

/** `none` — фолбэк по умолчанию для старых документов, см. тот же принцип,
 * что у `CARD_BORDER_PX` выше: тени не было нигде до этого инкремента, и
 * старые сайты не должны внезапно её получить. */
const CARD_SHADOW_VALUE: Record<ThemeCardShadow, string> = {
  none: 'none',
  sm: '0 1px 3px rgba(15, 23, 42, 0.08)',
  md: '0 6px 20px rgba(15, 23, 42, 0.12)',
};

/** Общая шкала отступов для `BlockStyle.paddingY`/`paddingX`/`marginTop`/
 * `marginBottom` — один и тот же токен на всех блоках (см. `types.ts`,
 * `SpacingSize`), поэтому «средний» отступ значит одно и то же visually
 * везде на сайте, независимо от того, какой блок его выставил. */
export const SPACING_PX: Record<SpacingSize, string> = {
  none: '0px',
  sm: '16px',
  md: '32px',
  lg: '56px',
  xl: '96px',
};

/**
 * Тема сайта → CSS custom properties на корневой обёртке `WebsiteRenderer`
 * — весь рендер блоков (и в билдере, и на публичной странице/Preview, см.
 * корневой план: «один и тот же renderer везде») читает только эти
 * `--site-*`-переменные в своих `*.module.scss`, никогда напрямую
 * `theme.colors.primary` и т. п. — поэтому смена темы применяется мгновенно
 * ко всему дереву без перерендера самих блоков.
 */
export function buildThemeCssVars(theme: WebsiteTheme): Record<string, string> {
  return {
    '--site-primary': theme.colors.primary,
    '--site-secondary': theme.colors.secondary,
    '--site-bg': theme.colors.background,
    '--site-surface': theme.colors.surface,
    '--site-text': theme.colors.text,
    '--site-muted': theme.colors.muted,
    '--site-border': theme.colors.border,
    '--site-radius': RADIUS_PX[theme.radius],
    '--site-font-heading': resolveFontStack(theme.fonts.heading, theme.fonts.googleFontHeading),
    '--site-font-body': resolveFontStack(theme.fonts.body, theme.fonts.googleFontBody),
    '--site-container-width': CONTAINER_WIDTH_PX[theme.containerWidth],
    '--site-section-spacing': SECTION_SPACING_PX[theme.sectionSpacing],
    '--site-card-border-width': CARD_BORDER_PX[theme.cardBorder ?? 'hairline'],
    '--site-card-shadow': CARD_SHADOW_VALUE[theme.cardShadow ?? 'none'],
  };
}

export const FONT_CHOICE_OPTIONS: { value: FontChoice; label: string }[] = [
  { value: 'display-serif', label: 'Витринный серф' },
  { value: 'ui-sans', label: 'Простой гротеск' },
  { value: 'classic-serif', label: 'Классический серф' },
  { value: 'rounded', label: 'Скруглённый' },
  { value: 'mono', label: 'Моноширинный' },
  { value: 'google', label: 'Google Font…' },
];

export const RADIUS_OPTIONS: { value: ThemeRadius; label: string }[] = [
  { value: 'none', label: 'Без скругления' },
  { value: 'sm', label: 'Небольшое' },
  { value: 'md', label: 'Среднее' },
  { value: 'lg', label: 'Крупное' },
  { value: 'full', label: 'Максимальное' },
];

export const SECTION_SPACING_OPTIONS: { value: SectionSpacing; label: string }[] = [
  { value: 'compact', label: 'Компактно' },
  { value: 'comfortable', label: 'Комфортно' },
  { value: 'spacious', label: 'Просторно' },
];

/** Опции общей секции «Отступы и фон» в инспекторе (см. `BlockStyle` в
 * `types.ts` и `widgets/website-builder/ui/inspector/LayoutSection.tsx`) —
 * те же значения, что читает `computeBlockWrapperStyle` (`block-style.ts`),
 * просто с человекочитаемыми подписями для `select`-полей. */
export const BACKGROUND_OPTIONS: { value: Background; label: string }[] = [
  { value: 'none', label: 'Без фона' },
  { value: 'surface', label: 'Поверхность' },
  { value: 'muted', label: 'Приглушённый' },
  { value: 'primary', label: 'Акцентный' },
  { value: 'dark', label: 'Тёмный' },
  { value: 'custom', label: 'Свой цвет' },
  { value: 'gradient', label: 'Градиент' },
];

export const GRADIENT_TYPE_OPTIONS: {
  value: NonNullable<BlockStyle['gradientType']>;
  label: string;
}[] = [
  { value: 'linear', label: 'Линейный' },
  { value: 'radial', label: 'Радиальный' },
];

export const TEXT_ALIGN_OPTIONS: { value: TextAlign; label: string }[] = [
  { value: 'left', label: 'Слева' },
  { value: 'center', label: 'По центру' },
  { value: 'right', label: 'Справа' },
];

/** Порядок начинается с `'default'` не случайно — это фактическое поведение
 * `computeBlockWrapperStyle` (`block-style.ts`) при отсутствии `maxWidth`
 * (`blockStyle.maxWidth ?? 'default'`), а `select`-поле без явного значения
 * в `props`/`style` показывает именно первую опцию списка. */
export const CONTAINER_WIDTH_OPTIONS: { value: ContainerWidth; label: string }[] = [
  { value: 'default', label: 'Обычный' },
  { value: 'narrow', label: 'Узкий' },
  { value: 'wide', label: 'Широкий' },
  { value: 'full', label: 'Во всю ширину' },
];

export const SPACING_SIZE_OPTIONS: { value: SpacingSize; label: string }[] = [
  { value: 'none', label: 'Нет' },
  { value: 'sm', label: 'Маленький' },
  { value: 'md', label: 'Средний' },
  { value: 'lg', label: 'Крупный' },
  { value: 'xl', label: 'Очень крупный' },
];

/** Опции для `widgets/website-builder/inspector/ThemePanel.tsx` — глобальные
 * настройки темы сайта, в отличие от `CONTAINER_WIDTH_OPTIONS`/
 * `SPACING_SIZE_OPTIONS` выше, которые про отдельный блок. */
export const BUTTON_STYLE_OPTIONS: { value: ButtonStyle; label: string }[] = [
  { value: 'solid', label: 'Заливка' },
  { value: 'outline', label: 'Контур' },
  { value: 'soft', label: 'Приглушённая заливка' },
];

export const THEME_CONTAINER_WIDTH_OPTIONS: {
  value: WebsiteTheme['containerWidth'];
  label: string;
}[] = [
  { value: 'default', label: 'Обычная' },
  { value: 'wide', label: 'Широкая' },
];

export const CARD_BORDER_OPTIONS: { value: ThemeCardBorder; label: string }[] = [
  { value: 'none', label: 'Без рамки' },
  { value: 'hairline', label: 'Тонкая' },
  { value: 'bold', label: 'Плотная' },
];

export const CARD_SHADOW_OPTIONS: { value: ThemeCardShadow; label: string }[] = [
  { value: 'none', label: 'Без тени' },
  { value: 'sm', label: 'Лёгкая' },
  { value: 'md', label: 'Заметная' },
];
