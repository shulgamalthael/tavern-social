import { describe, expect, it } from 'vitest';
import { buildValidatedStyle } from './block-style-schema';

describe('buildValidatedStyle', () => {
  it('starts from an empty style when the block has none yet', () => {
    expect(buildValidatedStyle(undefined, { background: 'surface' })).toEqual({
      background: 'surface',
    });
  });

  it('merges only the provided fields over the existing style', () => {
    const existing = { background: 'surface', textAlign: 'center' };
    expect(buildValidatedStyle(existing, { paddingY: 'lg' })).toEqual({
      background: 'surface',
      textAlign: 'center',
      paddingY: 'lg',
    });
  });

  it('overwrites a field that is set on both sides', () => {
    expect(buildValidatedStyle({ background: 'surface' }, { background: 'dark' })).toEqual({
      background: 'dark',
    });
  });

  it('removes a field entirely when given null', () => {
    const existing = { background: 'surface', textAlign: 'center' };
    expect(buildValidatedStyle(existing, { background: null })).toEqual({ textAlign: 'center' });
  });

  it('rejects an unknown style field', () => {
    expect(() => buildValidatedStyle(undefined, { color: 'red' })).toThrow(/Неизвестные поля/);
  });

  it('rejects a value outside the enum for a known field', () => {
    expect(() => buildValidatedStyle(undefined, { background: 'rainbow' })).toThrow(
      /должно быть одним из/,
    );
  });

  it('rejects a non-object style payload', () => {
    expect(() => buildValidatedStyle(undefined, 'surface')).toThrow(/должен быть объектом/);
  });

  it('accepts a custom background with a valid hex color', () => {
    expect(
      buildValidatedStyle(undefined, { background: 'custom', customBackgroundColor: '#1a2b3c' }),
    ).toEqual({ background: 'custom', customBackgroundColor: '#1a2b3c' });
  });

  it('rejects a customBackgroundColor that is not a valid hex color', () => {
    expect(() => buildValidatedStyle(undefined, { customBackgroundColor: 'not-a-color' })).toThrow(
      /hex-цветом/,
    );
    expect(() => buildValidatedStyle(undefined, { customBackgroundColor: '#fff' })).toThrow(
      /hex-цветом/,
    );
  });

  it('removes customBackgroundColor when given null', () => {
    const existing = { background: 'custom', customBackgroundColor: '#1a2b3c' };
    expect(buildValidatedStyle(existing, { customBackgroundColor: null })).toEqual({
      background: 'custom',
    });
  });

  it('accepts a numeric px value for a spacing field', () => {
    expect(buildValidatedStyle(undefined, { paddingY: 18 })).toEqual({ paddingY: 18 });
    expect(buildValidatedStyle(undefined, { marginBottom: 64 })).toEqual({ marginBottom: 64 });
  });

  it('accepts a numeric 0 for a spacing field, not confused with "no value"', () => {
    expect(buildValidatedStyle(undefined, { paddingX: 0 })).toEqual({ paddingX: 0 });
  });

  it('rejects a negative or out-of-range numeric spacing value', () => {
    expect(() => buildValidatedStyle(undefined, { paddingY: -5 })).toThrow(/от 0 до 400/);
    expect(() => buildValidatedStyle(undefined, { paddingY: 401 })).toThrow(/от 0 до 400/);
    expect(() => buildValidatedStyle(undefined, { paddingY: Infinity })).toThrow(/от 0 до 400/);
  });

  it('still rejects a non-numeric, non-enum spacing value', () => {
    expect(() => buildValidatedStyle(undefined, { paddingY: 'huge' })).toThrow(
      /должно быть одним из/,
    );
  });

  it('rejects a numeric value for a field that is not a spacing field', () => {
    expect(() => buildValidatedStyle(undefined, { background: 5 })).toThrow(/должно быть одним из/);
  });

  it('leaves untouched fields alone across the whole allowed set', () => {
    const existing = {
      background: 'primary',
      paddingY: 'sm',
      paddingX: 'sm',
      marginTop: 'md',
      marginBottom: 'md',
      textAlign: 'left',
      maxWidth: 'wide',
    };
    expect(buildValidatedStyle(existing, { maxWidth: 'full' })).toEqual({
      ...existing,
      maxWidth: 'full',
    });
  });
});
