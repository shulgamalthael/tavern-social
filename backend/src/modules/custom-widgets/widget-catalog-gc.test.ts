import { describe, expect, it } from 'vitest';
import { selectWidgetsToDemote, type CatalogWidgetSnapshot } from './widget-catalog-gc.lib';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-06T00:00:00.000Z');
const GRACE_MS = 14 * DAY_MS;

function widget(
  id: string,
  sharedDaysAgo: number,
  catalogInsertCount: number,
): CatalogWidgetSnapshot {
  return {
    id,
    sharedAt: new Date(NOW.getTime() - sharedDaysAgo * DAY_MS),
    catalogInsertCount,
  };
}

describe('selectWidgetsToDemote', () => {
  it('keeps a young, unused widget — still inside the grace period', () => {
    const result = selectWidgetsToDemote([widget('a', 2, 0)], NOW, GRACE_MS, 1);
    expect(result).toEqual([]);
  });

  it('demotes an old, unused widget — past the grace period with zero adoption', () => {
    const result = selectWidgetsToDemote([widget('a', 20, 0)], NOW, GRACE_MS, 1);
    expect(result).toEqual(['a']);
  });

  it('keeps an old widget that has real cross-business adoption', () => {
    const result = selectWidgetsToDemote([widget('a', 20, 3)], NOW, GRACE_MS, 1);
    expect(result).toEqual([]);
  });

  it('handles a mixed batch, only returning the ones that actually qualify', () => {
    const result = selectWidgetsToDemote(
      [widget('young-unused', 1, 0), widget('old-used', 30, 5), widget('old-unused', 30, 0)],
      NOW,
      GRACE_MS,
      1,
    );
    expect(result).toEqual(['old-unused']);
  });
});
