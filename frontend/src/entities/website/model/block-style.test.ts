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
