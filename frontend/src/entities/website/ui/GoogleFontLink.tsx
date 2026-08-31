import { googleFontsStylesheetUrl } from '../model/google-fonts';
import type { WebsiteTheme } from '../model/types';

export interface GoogleFontLinkProps {
  theme: WebsiteTheme;
}

/**
 * Загружает реальные веб-шрифты для `FontChoice: 'google'` (см.
 * `google-fonts.ts`) — рендерит `<link rel="stylesheet">` на Google Fonts
 * CSS2 API, только если тема реально использует хотя бы один такой шрифт
 * (`googleFontsStylesheetUrl` возвращает `null`, если нет — ничего не
 * рендерим, ноль лишних запросов для сайтов без Google Fonts, тот же принцип,
 * что был у системных стеков до этого инкремента).
 *
 * React 19 хостит `<link>` (как и `<title>`/`<meta>`) в `<head>` автоматически
 * из любого места дерева, с дедупликацией по одинаковому `href` — поэтому
 * этот компонент можно безопасно рендерить в нескольких местах одновременно
 * (`WebsiteRenderer.tsx` — публичная страница и Preview, `Canvas.tsx` —
 * канвас билдера) без ручного управления `<head>` на уровне страницы/layout.
 */
export function GoogleFontLink({ theme }: GoogleFontLinkProps) {
  const url = googleFontsStylesheetUrl([theme.fonts.googleFontHeading, theme.fonts.googleFontBody]);
  if (!url) return null;
  return <link rel="stylesheet" href={url} />;
}
