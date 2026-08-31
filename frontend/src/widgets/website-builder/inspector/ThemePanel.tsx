'use client';

import {
  BUTTON_STYLE_OPTIONS,
  CARD_BORDER_OPTIONS,
  CARD_SHADOW_OPTIONS,
  FONT_CHOICE_OPTIONS,
  GOOGLE_FONT_OPTIONS,
  RADIUS_OPTIONS,
  SECTION_SPACING_OPTIONS,
  THEME_CONTAINER_WIDTH_OPTIONS,
  useWebsiteBuilderStore,
  type FieldSchema,
  type GoogleFontId,
  type WebsiteTheme,
  type WebsiteThemeColors,
} from '@/entities/website';
import { FieldGroup, type FieldGroupItem } from './FieldGroup';
import styles from './ThemePanel.module.scss';

const COLOR_FIELDS: { key: keyof WebsiteThemeColors; label: string }[] = [
  { key: 'primary', label: 'Основной' },
  { key: 'secondary', label: 'Дополнительный' },
  { key: 'background', label: 'Фон страницы' },
  { key: 'surface', label: 'Фон карточек' },
  { key: 'text', label: 'Текст' },
  { key: 'muted', label: 'Приглушённый текст' },
  { key: 'border', label: 'Границы' },
];

const HEADING_FONT_FIELD: FieldSchema = {
  key: 'heading',
  label: 'Шрифт заголовков',
  control: 'select',
  options: FONT_CHOICE_OPTIONS,
};

const BODY_FONT_FIELD: FieldSchema = {
  key: 'body',
  label: 'Шрифт текста',
  control: 'select',
  options: FONT_CHOICE_OPTIONS,
};

const GOOGLE_FONT_HEADING_FIELD: FieldSchema = {
  key: 'googleFontHeading',
  label: 'Google Font — заголовки',
  control: 'select',
  options: GOOGLE_FONT_OPTIONS,
};

const GOOGLE_FONT_BODY_FIELD: FieldSchema = {
  key: 'googleFontBody',
  label: 'Google Font — текст',
  control: 'select',
  options: GOOGLE_FONT_OPTIONS,
};

const RADIUS_FIELD: FieldSchema = {
  key: 'radius',
  label: 'Скругление',
  control: 'select',
  options: RADIUS_OPTIONS,
};
const BUTTON_STYLE_FIELD: FieldSchema = {
  key: 'buttonStyle',
  label: 'Стиль кнопок',
  control: 'select',
  options: BUTTON_STYLE_OPTIONS,
};
const CONTAINER_WIDTH_FIELD: FieldSchema = {
  key: 'containerWidth',
  label: 'Ширина сайта',
  control: 'select',
  options: THEME_CONTAINER_WIDTH_OPTIONS,
};
const SECTION_SPACING_FIELD: FieldSchema = {
  key: 'sectionSpacing',
  label: 'Плотность секций',
  control: 'select',
  options: SECTION_SPACING_OPTIONS,
};
const CARD_BORDER_FIELD: FieldSchema = {
  key: 'cardBorder',
  label: 'Рамка карточек',
  control: 'select',
  options: CARD_BORDER_OPTIONS,
};
const CARD_SHADOW_FIELD: FieldSchema = {
  key: 'cardShadow',
  label: 'Тень карточек',
  control: 'select',
  options: CARD_SHADOW_OPTIONS,
};

/** Показывает выбор конкретного Google Font сразу после заголовка/текста
 * только когда этот слот реально стоит на `'google'` — та же логика, что и
 * условная вставка `customBackgroundColor` в `LayoutSection.tsx`: пустой
 * второй select всем, кто выбрал системный стек, был бы шумом. */
function buildFontItems(
  theme: WebsiteTheme,
  updateTheme: (patch: Partial<WebsiteTheme>) => void,
): FieldGroupItem[] {
  const items: FieldGroupItem[] = [
    {
      field: HEADING_FONT_FIELD,
      value: theme.fonts.heading,
      onChange: (next: unknown) =>
        updateTheme({
          fonts: { ...theme.fonts, heading: next as WebsiteTheme['fonts']['heading'] },
        }),
    },
  ];

  if (theme.fonts.heading === 'google') {
    items.push({
      field: GOOGLE_FONT_HEADING_FIELD,
      value: theme.fonts.googleFontHeading ?? '',
      onChange: (next: unknown) =>
        updateTheme({ fonts: { ...theme.fonts, googleFontHeading: next as GoogleFontId } }),
    });
  }

  items.push({
    field: BODY_FONT_FIELD,
    value: theme.fonts.body,
    onChange: (next: unknown) =>
      updateTheme({ fonts: { ...theme.fonts, body: next as WebsiteTheme['fonts']['body'] } }),
  });

  if (theme.fonts.body === 'google') {
    items.push({
      field: GOOGLE_FONT_BODY_FIELD,
      value: theme.fonts.googleFontBody ?? '',
      onChange: (next: unknown) =>
        updateTheme({ fonts: { ...theme.fonts, googleFontBody: next as GoogleFontId } }),
    });
  }

  return items;
}

export interface ThemePanelProps {
  theme: WebsiteTheme;
  businessId: string;
}

/**
 * Глобальная тема сайта — палитра, шрифты, скругление, стиль кнопок,
 * ширина и плотность секций, рамка/тень карточек (см. `WebsiteTheme` в
 * `entities/website/model/types.ts`). В отличие от `BlockInspectorForm.tsx`,
 * это не `definition.fields` конкретного блока, а фиксированный набор полей
 * одной темы на весь документ — правки применяются мгновенно ко всем блокам
 * страницы через CSS-переменные `--site-*` (`buildThemeCssVars`,
 * `Canvas.tsx`), без точечного перерендера дерева блоков.
 *
 * «Рамка карточек»/«Тень карточек» (ROADMAP.md §3.5/§8 Phase 11) — общий
 * токен для всех карточных поверхностей блоков (`.icon-card`/`.people-card`/
 * `.simple-card`/`.service-card`/`.pricing-plan`/`.team-member`, см.
 * комментарии `ThemeCardBorder`/`ThemeCardShadow` в `types.ts`), не для
 * кнопок/форм/секций — те не задумывались как одна визуальная поверхность.
 */
export function ThemePanel({ theme, businessId }: ThemePanelProps) {
  const updateTheme = useWebsiteBuilderStore((state) => state.updateTheme);

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <h3 className={styles.section__title}>Цвета</h3>
        <FieldGroup
          resetKey="theme-colors"
          businessId={businessId}
          items={COLOR_FIELDS.map(({ key, label }) => ({
            field: { key, label, control: 'color' as const },
            value: theme.colors[key],
            onChange: (next: unknown) =>
              updateTheme({ colors: { ...theme.colors, [key]: next as string } }),
          }))}
        />
      </section>

      <section className={styles.section}>
        <h3 className={styles.section__title}>Шрифты</h3>
        <FieldGroup
          resetKey="theme-fonts"
          businessId={businessId}
          items={buildFontItems(theme, updateTheme)}
        />
      </section>

      <section className={styles.section}>
        <h3 className={styles.section__title}>Форма и раскладка</h3>
        <FieldGroup
          resetKey="theme-layout"
          businessId={businessId}
          items={[
            {
              field: RADIUS_FIELD,
              value: theme.radius,
              onChange: (next: unknown) => updateTheme({ radius: next as WebsiteTheme['radius'] }),
            },
            {
              field: BUTTON_STYLE_FIELD,
              value: theme.buttonStyle,
              onChange: (next: unknown) =>
                updateTheme({ buttonStyle: next as WebsiteTheme['buttonStyle'] }),
            },
            {
              field: CONTAINER_WIDTH_FIELD,
              value: theme.containerWidth,
              onChange: (next: unknown) =>
                updateTheme({ containerWidth: next as WebsiteTheme['containerWidth'] }),
            },
            {
              field: SECTION_SPACING_FIELD,
              value: theme.sectionSpacing,
              onChange: (next: unknown) =>
                updateTheme({ sectionSpacing: next as WebsiteTheme['sectionSpacing'] }),
            },
          ]}
        />
      </section>

      <section className={styles.section}>
        <h3 className={styles.section__title}>Карточки</h3>
        <FieldGroup
          resetKey="theme-cards"
          businessId={businessId}
          items={[
            {
              field: CARD_BORDER_FIELD,
              value: theme.cardBorder ?? 'hairline',
              onChange: (next: unknown) =>
                updateTheme({ cardBorder: next as WebsiteTheme['cardBorder'] }),
            },
            {
              field: CARD_SHADOW_FIELD,
              value: theme.cardShadow ?? 'none',
              onChange: (next: unknown) =>
                updateTheme({ cardShadow: next as WebsiteTheme['cardShadow'] }),
            },
          ]}
        />
      </section>
    </div>
  );
}
