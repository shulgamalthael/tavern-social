import { describe, expect, it } from 'vitest';
import { calculateClearingPriceCents } from './clearing-price';

describe('calculateClearingPriceCents', () => {
  it('charges the next-lower distinct bid when one exists', () => {
    expect(calculateClearingPriceCents(500, [500, 300, 100])).toBe(300);
  });

  it('falls back to the winner own bid when no competitor is strictly lower', () => {
    expect(calculateClearingPriceCents(500, [])).toBe(500);
  });

  it('skips bids tied with the winner (including its own other creatives) and finds the true runner-up', () => {
    // Two entries at 500 (winner's own bid, possibly from a second creative
    // of the same campaign) must not count as "a competitor below me".
    expect(calculateClearingPriceCents(500, [500, 500, 200])).toBe(200);
  });

  it('falls back to the winner own bid when every other bid is a tie at the top', () => {
    expect(calculateClearingPriceCents(500, [500, 500])).toBe(500);
  });

  it('picks the highest of several lower bids, not just the first one seen', () => {
    expect(calculateClearingPriceCents(1000, [100, 400, 250])).toBe(400);
  });
});
