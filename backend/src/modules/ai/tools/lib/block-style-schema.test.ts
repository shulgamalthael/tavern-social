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
