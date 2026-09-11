import { describe, expect, it } from 'vitest';
import { buildValidatedTheme } from './theme-schema';

describe('buildValidatedTheme', () => {
  it('merges a partial colors patch over the existing theme', () => {
    const existing = { colors: { primary: '#111111', secondary: '#222222' }, radius: 'md' };
    expect(buildValidatedTheme(existing, { colors: { primary: '#ff0000' } })).toEqual({
      colors: { primary: '#ff0000', secondary: '#222222' },
      fonts: {},
      radius: 'md',
    });
  });

  it('rejects an invalid hex color', () => {
    expect(() => buildValidatedTheme(undefined, { colors: { primary: 'red' } })).toThrow(
      /colors\.primary/,
    );
  });

  it('rejects an unknown color key', () => {
    expect(() => buildValidatedTheme(undefined, { colors: { accent: '#111111' } })).toThrow(
      /Неизвестные поля colors/,
    );
  });

  it('validates fonts.heading/body against the curated FontChoice list', () => {
    expect(() => buildValidatedTheme(undefined, { fonts: { heading: 'comic-sans' } })).toThrow(
      /fonts\.heading/,
    );
    expect(buildValidatedTheme(undefined, { fonts: { heading: 'ui-sans' } })).toEqual({
      colors: {},
      fonts: { heading: 'ui-sans' },
    });
  });

  it('validates googleFontHeading against the curated GoogleFontId list, and null clears it', () => {
    expect(() =>
      buildValidatedTheme(undefined, { fonts: { googleFontHeading: 'comic-sans' } }),
    ).toThrow(/fonts\.googleFontHeading/);

    const withGoogleFont = buildValidatedTheme(undefined, {
      fonts: { heading: 'google', googleFontHeading: 'inter' },
    });
    expect(withGoogleFont.fonts).toEqual({ heading: 'google', googleFontHeading: 'inter' });

    expect(
      buildValidatedTheme(withGoogleFont, { fonts: { googleFontHeading: null } }).fonts,
    ).toEqual({ heading: 'google' });
  });

  it('validates radius/buttonStyle/containerWidth/sectionSpacing enums', () => {
    expect(() => buildValidatedTheme(undefined, { radius: 'huge' })).toThrow(/radius/);
    expect(buildValidatedTheme(undefined, { radius: 'full' }).radius).toBe('full');
    expect(() => buildValidatedTheme(undefined, { buttonStyle: 'fancy' })).toThrow(/buttonStyle/);
    expect(() => buildValidatedTheme(undefined, { containerWidth: 'huge' })).toThrow(
      /containerWidth/,
    );
    expect(() => buildValidatedTheme(undefined, { sectionSpacing: 'huge' })).toThrow(
      /sectionSpacing/,
    );
  });

  it('cardBorder/cardShadow accept null to remove the optional field', () => {
    const existing = { cardBorder: 'bold', cardShadow: 'md' };
    expect(buildValidatedTheme(existing, { cardBorder: null, cardShadow: null })).toEqual({
      colors: {},
      fonts: {},
    });
  });

  it('rejects an unknown top-level field', () => {
    expect(() => buildValidatedTheme(undefined, { notARealThemeField: 'x' })).toThrow(
      /Неизвестные поля темы/,
    );
  });

  it('rejects a non-object theme patch', () => {
    expect(() => buildValidatedTheme(undefined, 'not-an-object')).toThrow(/должен быть объектом/);
  });
});
