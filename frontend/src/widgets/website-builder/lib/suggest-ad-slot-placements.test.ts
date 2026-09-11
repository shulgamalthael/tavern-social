import { describe, expect, it } from 'vitest';
import type { WebsiteBlock } from '@/entities/website';
import { suggestAdSlotPlacements } from './suggest-ad-slot-placements';

function block(type: string): WebsiteBlock {
  return { id: `${type}-${Math.random()}`, type, props: {} };
}

describe('suggestAdSlotPlacements', () => {
  it('returns nothing when no slots are available', () => {
    const blocks = [block('text'), block('text'), block('text'), block('text')];
    expect(suggestAdSlotPlacements(blocks, 0)).toEqual([]);
  });

  it('proposes an insertion point after every 2nd content block', () => {
    const blocks = [block('heading'), block('text'), block('text'), block('image')];
    // content blocks at indices 0,1,2,3 — every 2nd → after index 1 and after index 3
    expect(suggestAdSlotPlacements(blocks, 10)).toEqual([2, 4]);
  });

  it('caps suggestions at availableCount', () => {
    const blocks = [block('text'), block('text'), block('text'), block('text')];
    expect(suggestAdSlotPlacements(blocks, 1)).toEqual([2]);
  });

  it('never counts hero/form/nav/footer blocks as content', () => {
    const blocks = [block('hero'), block('text'), block('text'), block('image')];
    // hero excluded from the count entirely — only the two `text` blocks and
    // `image` count, proposing one insertion after the 2nd content block (index 2)
    expect(suggestAdSlotPlacements(blocks, 10)).toEqual([3]);
  });

  it('never proposes an insertion point immediately before a skipped block', () => {
    const blocks = [block('text'), block('text'), block('contactform')];
    // after the 2nd content block would land right before `contactform` — must be skipped
    expect(suggestAdSlotPlacements(blocks, 10)).toEqual([]);
  });

  it('never proposes an insertion point immediately before hero/businessheader', () => {
    const blocks = [
      block('text'),
      block('text'),
      block('businessheader'),
      block('text'),
      block('text'),
    ];
    // first proposal (index 2) would land right before `businessheader` — skipped;
    // second proposal counts the 3rd and 4th content blocks (indices 3,4) → after index 4
    expect(suggestAdSlotPlacements(blocks, 10)).toEqual([5]);
  });

  it('returns indices in ascending order against the ORIGINAL array (caller must apply descending)', () => {
    const blocks = Array.from({ length: 8 }, () => block('text'));
    const result = suggestAdSlotPlacements(blocks, 10);
    expect(result).toEqual([...result].sort((a, b) => a - b));
  });
});
