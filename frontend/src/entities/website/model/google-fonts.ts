/**
 * Курируемый список Google Fonts для `FontChoice: 'google'` (см. `types.ts`)
 * — сознательно НЕ произвольная строка с именем шрифта: она пошла бы прямо
 * в URL `fonts.googleapis.com` без реального способа проверить, что это
 * действительно существующий шрифт, а не мусор/инъекция. Курируемый список
 * — тот же принцип решения, что уже принят для системных стеков
 * (`FONT_STACKS` в `theme-tokens.ts`) и для цветов темы (7 именованных
 * ролей, не любой CSS-цвет без ограничений).
 */

export type GoogleFontId =
  | 'inter'
  | 'playfair-display'
  | 'poppins'
  | 'montserrat'
  | 'lora'
  | 'space-grotesk'
  | 'dm-sans'
  | 'merriweather'
  | 'bebas-neue'
  | 'roboto';

interface GoogleFontDef {
  label: string;
  /** Реальное имя шрифта для CSS `font-family`. */
  family: string;
  /** Параметр `family=` для Google Fonts CSS2 API, с нужными начертаниями. */
  googleParam: string;
  /** Родовой fallback-стек на случай, если сам шрифт не успел/не смог
   * загрузиться. */
  fallback: string;
}

const GOOGLE_FONTS: Record<GoogleFontId, GoogleFontDef> = {
  inter: {
    label: 'Inter',
    family: 'Inter',
    googleParam: 'Inter:wght@400;600;700',
    fallback: 'sans-serif',
  },
  'playfair-display': {
    label: 'Playfair Display',
    family: 'Playfair Display',
    googleParam: 'Playfair+Display:wght@400;700',
    fallback: 'serif',
  },
  poppins: {
    label: 'Poppins',
    family: 'Poppins',
    googleParam: 'Poppins:wght@400;600;700',
    fallback: 'sans-serif',
  },
  montserrat: {
    label: 'Montserrat',
    family: 'Montserrat',
    googleParam: 'Montserrat:wght@400;600;700',
    fallback: 'sans-serif',
  },
  lora: {
    label: 'Lora',
    family: 'Lora',
    googleParam: 'Lora:wght@400;600;700',
    fallback: 'serif',
  },
  'space-grotesk': {
    label: 'Space Grotesk',
    family: 'Space Grotesk',
    googleParam: 'Space+Grotesk:wght@400;600;700',
    fallback: 'sans-serif',
  },
  'dm-sans': {
    label: 'DM Sans',
    family: 'DM Sans',
    googleParam: 'DM+Sans:wght@400;600;700',
    fallback: 'sans-serif',
  },
  merriweather: {
    label: 'Merriweather',
    family: 'Merriweather',
    googleParam: 'Merriweather:wght@400;700',
    fallback: 'serif',
  },
  'bebas-neue': {
    label: 'Bebas Neue',
    family: 'Bebas Neue',
    googleParam: 'Bebas+Neue:wght@400',
    fallback: 'sans-serif',
  },
  roboto: {
    label: 'Roboto',
    family: 'Roboto',
    googleParam: 'Roboto:wght@400;600;700',
    fallback: 'sans-serif',
  },
};

export const GOOGLE_FONT_OPTIONS: { value: GoogleFontId; label: string }[] = (
  Object.keys(GOOGLE_FONTS) as GoogleFontId[]
).map((value) => ({ value, label: GOOGLE_FONTS[value].label }));

/** CSS `font-family` значение для `--site-font-heading`/`--site-font-body`
 * (см. `buildThemeCssVars` в `theme-tokens.ts`) — тот же формат, что и
 * `FONT_STACKS`, просто с реальным именем шрифта первым. */
export function googleFontFamily(id: GoogleFontId): string {
  const def = GOOGLE_FONTS[id];
  return `"${def.family}", ${def.fallback}`;
}

/**
 * URL стиллшита Google Fonts CSS2 API для одного или двух выбранных
 * шрифтов сразу (заголовок и текст вместе одним запросом, если оба
 * `'google'`) — `null`, если список пуст, чтобы вызывающему (`GoogleFontLink`)
 * было просто ничего не рендерить вместо пустого `<link href="">`.
 */
export function googleFontsStylesheetUrl(ids: (GoogleFontId | undefined)[]): string | null {
  const unique = Array.from(new Set(ids.filter((id): id is GoogleFontId => Boolean(id))));
  if (unique.length === 0) return null;
  const families = unique.map((id) => GOOGLE_FONTS[id].googleParam).join('&family=');
  return `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
}
