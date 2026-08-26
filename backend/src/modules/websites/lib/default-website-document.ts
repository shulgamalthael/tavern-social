import type { WebsiteDocument } from '../websites.types';

/** Дефолтная тема нового сайта — те же значения, что frontend показывает как
 * дефолт/сброс в панели темы билдера (см. `entities/website/model/
 * default-theme.ts`), продублировано намеренно: backend и frontend — разные
 * TS-проекты без общего пакета типов (тот же принцип, что и у остальных DTO
 * в проекте, см. AGENTS.md backend). Изменили дефолт — правьте оба места. */
export function createDefaultWebsiteDocument(businessName: string): WebsiteDocument {
  return {
    pages: [
      {
        id: 'home',
        slug: 'home',
        title: 'Главная',
        blocks: [],
        seoTitle: null,
        seoDescription: null,
        ogImage: null,
      },
    ],
    theme: {
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
    },
    settings: {
      seoTitle: businessName,
      seoDescription: '',
    },
  };
}
