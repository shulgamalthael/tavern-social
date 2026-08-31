import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from './default-theme';
import { buildThemeCssVars } from './theme-tokens';
import type { WebsiteTheme } from './types';

describe('buildThemeCssVars — Google Fonts', () => {
  it('uses the system font stack when heading/body are not "google"', () => {
    const vars = buildThemeCssVars(DEFAULT_THEME);
    expect(vars['--site-font-heading']).not.toContain('"Inter"');
  });

  it('uses the real Google Font family when a slot is set to "google" with a chosen font', () => {
    const theme: WebsiteTheme = {
      ...DEFAULT_THEME,
      fonts: { heading: 'google', body: 'ui-sans', googleFontHeading: 'playfair-display' },
    };
    const vars = buildThemeCssVars(theme);
    expect(vars['--site-font-heading']).toBe('"Playfair Display", serif');
  });

  it('falls back to the ui-sans stack for "google" with no font chosen yet', () => {
    const theme: WebsiteTheme = {
      ...DEFAULT_THEME,
      fonts: { heading: 'google', body: 'ui-sans' },
    };
    const vars = buildThemeCssVars(theme);
    expect(vars['--site-font-heading']).toBe(
      `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
    );
  });

  it('resolves heading and body independently when both are Google Fonts', () => {
    const theme: WebsiteTheme = {
      ...DEFAULT_THEME,
      fonts: {
        heading: 'google',
        body: 'google',
        googleFontHeading: 'bebas-neue',
        googleFontBody: 'inter',
      },
    };
    const vars = buildThemeCssVars(theme);
    expect(vars['--site-font-heading']).toBe('"Bebas Neue", sans-serif');
    expect(vars['--site-font-body']).toBe('"Inter", sans-serif');
  });
});
