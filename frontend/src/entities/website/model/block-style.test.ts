import { describe, expect, it } from 'vitest';
import { computeBlockWrapperStyle } from './block-style';

describe('computeBlockWrapperStyle — custom background', () => {
  it('renders the custom hex color as background when background is "custom"', () => {
    const { outer } = computeBlockWrapperStyle(
      { background: 'custom', customBackgroundColor: '#1a2b3c' },
      'desktop',
    );
    expect(outer.background).toBe('#1a2b3c');
  });

  it('renders no background when "custom" is picked but no color is set yet', () => {
    const { outer } = computeBlockWrapperStyle({ background: 'custom' }, 'desktop');
    expect(outer.background).toBeUndefined();
  });

  it('switches text/muted/border to the light variant for a dark custom color', () => {
    const { outer } = computeBlockWrapperStyle(
      { background: 'custom', customBackgroundColor: '#0a0a0a' },
      'desktop',
    );
    expect(outer['--site-text' as keyof typeof outer]).toBe('#ffffff');
    // Не только переменная — `color` сам должен читать её заново на этой
    // обёртке, иначе блоки с `color: inherit` (напр. `.hero__heading`)
    // остаются с уже вычисленным тёмным цветом поверх тёмного фона.
    expect(outer.color).toBe('var(--site-text)');
  });

  it('keeps the default text color for a light custom color', () => {
    const { outer } = computeBlockWrapperStyle(
      { background: 'custom', customBackgroundColor: '#f5f5f5' },
      'desktop',
    );
    expect(outer['--site-text' as keyof typeof outer]).toBeUndefined();
  });

  it('ignores customBackgroundColor when background is a preset, not "custom"', () => {
    const { outer } = computeBlockWrapperStyle(
      { background: 'surface', customBackgroundColor: '#0a0a0a' },
      'desktop',
    );
    expect(outer.background).toBe('var(--site-surface)');
    expect(outer['--site-text' as keyof typeof outer]).toBeUndefined();
  });
});

describe('computeBlockWrapperStyle — gradient background', () => {
  it('renders a linear-gradient with the given angle and stops', () => {
    const { outer } = computeBlockWrapperStyle(
      { background: 'gradient', gradientFrom: '#111111', gradientTo: '#eeeeee', gradientAngle: 45 },
      'desktop',
    );
    expect(outer.background).toBe('linear-gradient(45deg, #111111, #eeeeee)');
  });

  it('defaults the angle to 135 when not set', () => {
    const { outer } = computeBlockWrapperStyle(
      { background: 'gradient', gradientFrom: '#111111', gradientTo: '#eeeeee' },
      'desktop',
    );
    expect(outer.background).toBe('linear-gradient(135deg, #111111, #eeeeee)');
  });

  it('renders no background when "gradient" is picked but a stop is missing', () => {
    const { outer } = computeBlockWrapperStyle(
      { background: 'gradient', gradientFrom: '#111111' },
      'desktop',
    );
    expect(outer.background).toBeUndefined();
  });

  it('renders a radial-gradient and ignores the angle when gradientType is "radial"', () => {
    const { outer } = computeBlockWrapperStyle(
      {
        background: 'gradient',
        gradientType: 'radial',
        gradientFrom: '#111111',
        gradientTo: '#eeeeee',
        gradientAngle: 45,
      },
      'desktop',
    );
    expect(outer.background).toBe('radial-gradient(circle, #111111, #eeeeee)');
  });

  it('renders a linear-gradient when gradientType is explicitly "linear"', () => {
    const { outer } = computeBlockWrapperStyle(
      {
        background: 'gradient',
        gradientType: 'linear',
        gradientFrom: '#111111',
        gradientTo: '#eeeeee',
      },
      'desktop',
    );
    expect(outer.background).toBe('linear-gradient(135deg, #111111, #eeeeee)');
  });

  it('switches to light text only when both gradient stops are dark', () => {
    const bothDark = computeBlockWrapperStyle(
      { background: 'gradient', gradientFrom: '#0a0a0a', gradientTo: '#111111' },
      'desktop',
    );
    expect(bothDark.outer['--site-text' as keyof typeof bothDark.outer]).toBe('#ffffff');

    const mixed = computeBlockWrapperStyle(
      { background: 'gradient', gradientFrom: '#0a0a0a', gradientTo: '#ffffff' },
      'desktop',
    );
    expect(mixed.outer['--site-text' as keyof typeof mixed.outer]).toBeUndefined();
  });
});

describe('computeBlockWrapperStyle — per-block text color', () => {
  it('applies an explicit textColor as --site-text', () => {
    const { outer } = computeBlockWrapperStyle({ textColor: '#e63946' }, 'desktop');
    expect(outer['--site-text' as keyof typeof outer]).toBe('#e63946');
    expect(outer.color).toBe('var(--site-text)');
  });

  it('lets an explicit textColor win over the dark-background auto-contrast heuristic', () => {
    const { outer } = computeBlockWrapperStyle(
      { background: 'dark', textColor: '#123456' },
      'desktop',
    );
    // Without textColor this would auto-switch to white (#ffffff) — the
    // explicit choice must win, not the auto-contrast heuristic.
    expect(outer['--site-text' as keyof typeof outer]).toBe('#123456');
  });

  it('falls back to the auto-contrast heuristic when textColor is not set', () => {
    const { outer } = computeBlockWrapperStyle({ background: 'dark' }, 'desktop');
    expect(outer['--site-text' as keyof typeof outer]).toBe('#ffffff');
  });

  it('does not set --site-text at all when neither textColor nor a dark background is present', () => {
    const { outer } = computeBlockWrapperStyle({ textColor: '' }, 'desktop');
    expect(outer['--site-text' as keyof typeof outer]).toBeUndefined();
  });
});

describe('computeBlockWrapperStyle — block border and shadow', () => {
  it('renders no border/shadow/radius when neither is set', () => {
    const { outer } = computeBlockWrapperStyle({}, 'desktop');
    expect(outer.border).toBeUndefined();
    expect(outer.boxShadow).toBeUndefined();
    expect(outer.borderRadius).toBeUndefined();
  });

  it('renders a border with the preset width and a custom color', () => {
    const { outer } = computeBlockWrapperStyle(
      { borderWidth: 'thick', borderColor: '#ff0000' },
      'desktop',
    );
    expect(outer.border).toBe('4px solid #ff0000');
    expect(outer.borderRadius).toBe('var(--site-radius)');
  });

  it('falls back to the theme border color when borderColor is not set', () => {
    const { outer } = computeBlockWrapperStyle({ borderWidth: 'thin' }, 'desktop');
    expect(outer.border).toBe('1px solid var(--site-border)');
  });

  it('ignores borderColor when borderWidth is "none" or unset', () => {
    const { outer } = computeBlockWrapperStyle(
      { borderWidth: 'none', borderColor: '#ff0000' },
      'desktop',
    );
    expect(outer.border).toBeUndefined();
    expect(outer.borderRadius).toBeUndefined();
  });

  it('renders a shadow preset and applies the theme radius', () => {
    const { outer } = computeBlockWrapperStyle({ shadow: 'floating' }, 'desktop');
    expect(outer.boxShadow).toBe('0 24px 48px rgba(15, 23, 42, 0.24)');
    expect(outer.borderRadius).toBe('var(--site-radius)');
  });

  it('supports border and shadow together', () => {
    const { outer } = computeBlockWrapperStyle(
      { borderWidth: 'medium', shadow: 'soft' },
      'desktop',
    );
    expect(outer.border).toBe('2px solid var(--site-border)');
    expect(outer.boxShadow).toBe('0 1px 3px rgba(15, 23, 42, 0.06)');
    expect(outer.borderRadius).toBe('var(--site-radius)');
  });
});

describe('computeBlockWrapperStyle — custom pixel spacing', () => {
  it('renders a numeric paddingY/paddingX as literal px, not a preset', () => {
    const { outer, inner } = computeBlockWrapperStyle({ paddingY: 18, paddingX: 40 }, 'desktop');
    expect(outer.paddingTop).toBe('18px');
    expect(outer.paddingBottom).toBe('18px');
    expect(inner.paddingLeft).toBe('40px');
    expect(inner.paddingRight).toBe('40px');
  });

  it('renders a numeric marginTop/marginBottom as literal px', () => {
    const { outer } = computeBlockWrapperStyle({ marginTop: 12, marginBottom: 64 }, 'desktop');
    expect(outer.marginTop).toBe('12px');
    expect(outer.marginBottom).toBe('64px');
  });

  it('renders a custom 0px spacing, not the same as "no value set" (falsy-zero regression)', () => {
    const { outer } = computeBlockWrapperStyle({ paddingY: 0 }, 'desktop');
    expect(outer.paddingTop).toBe('0px');
    expect(outer.paddingBottom).toBe('0px');
  });

  it('still resolves a named preset normally alongside numeric fields being possible', () => {
    const { outer } = computeBlockWrapperStyle({ paddingY: 'lg' }, 'desktop');
    expect(outer.paddingTop).toBe('56px');
  });

  it('supports a numeric override on one advanced side while others inherit the pair', () => {
    const { outer, inner } = computeBlockWrapperStyle(
      {
        paddingY: 'md',
        paddingX: 'md',
        customPadding: true,
        paddingTop: 8,
      },
      'desktop',
    );
    expect(outer.paddingTop).toBe('8px');
    // paddingBottom/left/right have no per-side override → inherit the pair ('md' → 32px).
    expect(outer.paddingBottom).toBe('32px');
    expect(inner.paddingLeft).toBe('32px');
    expect(inner.paddingRight).toBe('32px');
  });

  it('leaves spacing undefined when nothing is set at all', () => {
    const { outer, inner } = computeBlockWrapperStyle(undefined, 'desktop');
    expect(outer.paddingTop).toBeUndefined();
    expect(outer.marginTop).toBeUndefined();
    expect(inner.paddingLeft).toBeUndefined();
  });
});
