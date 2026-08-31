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
