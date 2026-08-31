import { describe, expect, it } from 'vitest';
import { GOOGLE_FONT_OPTIONS, googleFontFamily, googleFontsStylesheetUrl } from './google-fonts';

describe('googleFontFamily', () => {
  it('returns the real font name quoted, with its fallback stack', () => {
    expect(googleFontFamily('inter')).toBe('"Inter", sans-serif');
    expect(googleFontFamily('playfair-display')).toBe('"Playfair Display", serif');
  });
});

describe('googleFontsStylesheetUrl', () => {
  it('returns null when no font id is given', () => {
    expect(googleFontsStylesheetUrl([])).toBeNull();
    expect(googleFontsStylesheetUrl([undefined, undefined])).toBeNull();
  });

  it('builds a single-family URL for one font', () => {
    const url = googleFontsStylesheetUrl(['inter', undefined]);
    expect(url).toBe(
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
    );
  });

  it('builds a multi-family URL when heading and body pick different fonts', () => {
    const url = googleFontsStylesheetUrl(['inter', 'playfair-display']);
    expect(url).toBe(
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Playfair+Display:wght@400;700&display=swap',
    );
  });

  it('de-duplicates when heading and body pick the same font', () => {
    const url = googleFontsStylesheetUrl(['inter', 'inter']);
    expect(url).toBe(
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
    );
  });
});

describe('GOOGLE_FONT_OPTIONS', () => {
  it('has one option per curated font, each with a real label', () => {
    expect(GOOGLE_FONT_OPTIONS.length).toBeGreaterThan(0);
    for (const option of GOOGLE_FONT_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});
