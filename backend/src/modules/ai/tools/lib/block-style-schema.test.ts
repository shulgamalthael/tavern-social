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

  it('accepts a gradient background with valid hex stops and an angle', () => {
    expect(
      buildValidatedStyle(undefined, {
        background: 'gradient',
        gradientFrom: '#1a2b3c',
        gradientTo: '#ffffff',
        gradientAngle: 45,
      }),
    ).toEqual({
      background: 'gradient',
      gradientFrom: '#1a2b3c',
      gradientTo: '#ffffff',
      gradientAngle: 45,
    });
  });

  it('rejects a gradientFrom/gradientTo that is not a valid hex color', () => {
    expect(() => buildValidatedStyle(undefined, { gradientFrom: 'red' })).toThrow(/hex-цветом/);
    expect(() => buildValidatedStyle(undefined, { gradientTo: '#fff' })).toThrow(/hex-цветом/);
  });

  it('rejects a gradientAngle outside 0-360', () => {
    expect(() => buildValidatedStyle(undefined, { gradientAngle: -10 })).toThrow(/от 0 до 360/);
    expect(() => buildValidatedStyle(undefined, { gradientAngle: 361 })).toThrow(/от 0 до 360/);
    expect(() => buildValidatedStyle(undefined, { gradientAngle: 'deg' })).toThrow(/от 0 до 360/);
  });

  it('accepts a valid gradientType', () => {
    expect(buildValidatedStyle(undefined, { gradientType: 'radial' })).toEqual({
      gradientType: 'radial',
    });
    expect(buildValidatedStyle(undefined, { gradientType: 'linear' })).toEqual({
      gradientType: 'linear',
    });
  });

  it('rejects an invalid gradientType', () => {
    expect(() => buildValidatedStyle(undefined, { gradientType: 'conic' })).toThrow(
      /должно быть одним из/,
    );
  });

  it('accepts a valid textColor', () => {
    expect(buildValidatedStyle(undefined, { textColor: '#ffffff' })).toEqual({
      textColor: '#ffffff',
    });
  });

  it('rejects an invalid textColor', () => {
    expect(() => buildValidatedStyle(undefined, { textColor: 'white' })).toThrow(/hex-цветом/);
  });

  it('removes textColor when given null', () => {
    const existing = { textColor: '#ffffff', background: 'dark' };
    expect(buildValidatedStyle(existing, { textColor: null })).toEqual({ background: 'dark' });
  });

  it('accepts a valid borderWidth and shadow', () => {
    expect(buildValidatedStyle(undefined, { borderWidth: 'thick' })).toEqual({
      borderWidth: 'thick',
    });
    expect(buildValidatedStyle(undefined, { shadow: 'floating' })).toEqual({
      shadow: 'floating',
    });
  });

  it('rejects an invalid borderWidth or shadow', () => {
    expect(() => buildValidatedStyle(undefined, { borderWidth: 'huge' })).toThrow(
      /должно быть одним из/,
    );
    expect(() => buildValidatedStyle(undefined, { shadow: 'extreme' })).toThrow(
      /должно быть одним из/,
    );
  });

  it('accepts a valid borderColor', () => {
    expect(buildValidatedStyle(undefined, { borderColor: '#123456' })).toEqual({
      borderColor: '#123456',
    });
  });

  it('rejects an invalid borderColor', () => {
    expect(() => buildValidatedStyle(undefined, { borderColor: 'blue' })).toThrow(/hex-цветом/);
  });

  it('removes borderWidth/borderColor/shadow when given null', () => {
    const existing = { borderWidth: 'thin', borderColor: '#123456', shadow: 'soft' };
    expect(
      buildValidatedStyle(existing, { borderWidth: null, borderColor: null, shadow: null }),
    ).toEqual({});
  });

  it('removes gradient fields when given null', () => {
    const existing = {
      background: 'gradient',
      gradientFrom: '#000000',
      gradientTo: '#ffffff',
      gradientAngle: 90,
    };
    expect(
      buildValidatedStyle(existing, { gradientFrom: null, gradientTo: null, gradientAngle: null }),
    ).toEqual({ background: 'gradient' });
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

  describe('AI_PLATFORM_ROADMAP.md §78 — "advanced" CSS bucket', () => {
    it('accepts a valid transform value', () => {
      expect(buildValidatedStyle(undefined, { advanced: { transform: 'rotate(-4deg)' } })).toEqual({
        advanced: { transform: 'rotate(-4deg)' },
      });
    });

    it('accepts a valid clip-path polygon value', () => {
      const value = 'polygon(0 0, 100% 0, 100% 85%, 0 100%)';
      expect(buildValidatedStyle(undefined, { advanced: { clipPath: value } })).toEqual({
        advanced: { clipPath: value },
      });
    });

    it('accepts a valid filter chain', () => {
      expect(
        buildValidatedStyle(undefined, { advanced: { filter: 'blur(6px) saturate(1.3)' } }),
      ).toEqual({ advanced: { filter: 'blur(6px) saturate(1.3)' } });
    });

    it('rejects a value containing url(...)', () => {
      expect(() =>
        buildValidatedStyle(undefined, { advanced: { filter: 'url(https://evil.example/x.svg)' } }),
      ).toThrow(/недопустимую конструкцию/);
    });

    it('rejects a value containing a stray semicolon/braces', () => {
      expect(() =>
        buildValidatedStyle(undefined, { advanced: { transform: 'rotate(1deg); } .x{color:red' } }),
      ).toThrow(/недопустимую конструкцию/);
    });

    it('rejects an unknown advanced property', () => {
      expect(() => buildValidatedStyle(undefined, { advanced: { notARealProperty: 'x' } })).toThrow(
        /Неизвестные поля advanced/,
      );
    });

    it('rejects a value over the length cap', () => {
      expect(() =>
        buildValidatedStyle(undefined, { advanced: { transform: 'a'.repeat(201) } }),
      ).toThrow(/не может быть длиннее/);
    });

    it('validates mixBlendMode/textTransform/fontStyle as exact keyword enums', () => {
      expect(() =>
        buildValidatedStyle(undefined, { advanced: { mixBlendMode: 'not-a-real-mode' } }),
      ).toThrow(/advanced\.mixBlendMode/);
      expect(buildValidatedStyle(undefined, { advanced: { mixBlendMode: 'multiply' } })).toEqual({
        advanced: { mixBlendMode: 'multiply' },
      });
    });

    it('validates opacity as a number string between 0 and 1', () => {
      expect(() => buildValidatedStyle(undefined, { advanced: { opacity: '1.5' } })).toThrow(
        /advanced\.opacity/,
      );
      expect(buildValidatedStyle(undefined, { advanced: { opacity: '0.6' } })).toEqual({
        advanced: { opacity: '0.6' },
      });
    });

    it('merges advanced partially and removes a field with null', () => {
      const existing = { advanced: { transform: 'rotate(4deg)', opacity: '0.9' } };
      expect(
        buildValidatedStyle(existing, { advanced: { opacity: null, filter: 'blur(2px)' } }),
      ).toEqual({ advanced: { transform: 'rotate(4deg)', filter: 'blur(2px)' } });
    });

    it('removes the whole advanced bucket when given null at the top level', () => {
      const existing = { background: 'surface', advanced: { transform: 'rotate(4deg)' } };
      expect(buildValidatedStyle(existing, { advanced: null })).toEqual({ background: 'surface' });
    });
  });
});
