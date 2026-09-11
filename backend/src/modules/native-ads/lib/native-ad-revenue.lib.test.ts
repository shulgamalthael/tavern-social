import { describe, expect, it } from 'vitest';
import { splitRevenue, type RevenueSplitSettings } from './native-ad-revenue.lib';

const DEFAULT_SETTINGS: RevenueSplitSettings = {
  creatorRevenueShareBps: 7000,
  platformFeeBps: 2500,
  paymentProcessingFeeBps: 500,
};

describe('splitRevenue', () => {
  it('splits an evenly-divisible amount with no rounding remainder', () => {
    const result = splitRevenue(1000, DEFAULT_SETTINGS);
    expect(result).toEqual({
      creatorShareCents: 700,
      platformFeeCents: 250,
      processingFeeCents: 50,
    });
  });

  it('the three parts always sum back to the original gross amount', () => {
    // 37 центов не делится ровно ни на одну из долей — проверяем, что
    // остаток (processingFeeCents) честно поглощает разницу округления, а
    // не теряет и не задваивает центы.
    const result = splitRevenue(37, DEFAULT_SETTINGS);
    const total = result.creatorShareCents + result.platformFeeCents + result.processingFeeCents;
    expect(total).toBe(37);
  });

  it('handles a zero gross amount without producing negative parts', () => {
    const result = splitRevenue(0, DEFAULT_SETTINGS);
    expect(result).toEqual({ creatorShareCents: 0, platformFeeCents: 0, processingFeeCents: 0 });
  });

  it('a 100% creator share leaves nothing for platform/processing', () => {
    const result = splitRevenue(500, {
      creatorRevenueShareBps: 10000,
      platformFeeBps: 0,
      paymentProcessingFeeBps: 0,
    });
    expect(result).toEqual({ creatorShareCents: 500, platformFeeCents: 0, processingFeeCents: 0 });
  });

  it('never produces a creator share larger than the gross amount', () => {
    const result = splitRevenue(1, DEFAULT_SETTINGS);
    expect(result.creatorShareCents).toBeLessThanOrEqual(1);
    expect(result.creatorShareCents + result.platformFeeCents + result.processingFeeCents).toBe(1);
  });
});
