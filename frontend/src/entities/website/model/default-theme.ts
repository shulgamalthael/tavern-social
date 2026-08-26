import type { WebsiteDocument, WebsiteTheme } from './types';

/** Те же значения, что backend кладёт в `createDefaultWebsiteDocument`
 * (`backend/src/modules/websites/lib/default-website-document.ts`) — два
 * разных TS-проекта без общего пакета типов, тот же принцип дублирования
 * DTO, что и у остальной части приложения (см. AGENTS.md backend). Меняете
 * дефолт — правьте оба места. */
export const DEFAULT_THEME: WebsiteTheme = {
  colors: {
    primary: '#2563eb',
    secondary: '#0f172a',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    muted: '#64748b',
    border: '#e2e8f0',
  },
  fonts: {
    heading: 'display-serif',
    body: 'ui-sans',
  },
  radius: 'md',
  buttonStyle: 'solid',
  containerWidth: 'default',
  sectionSpacing: 'comfortable',
  cardBorder: 'hairline',
  cardShadow: 'none',
};

export function createEmptyWebsiteDocument(businessName: string): WebsiteDocument {
  return {
    pages: [{ id: 'home', slug: 'home', title: 'Главная', blocks: [] }],
    theme: DEFAULT_THEME,
    settings: { seoTitle: businessName, seoDescription: '' },
  };
}
