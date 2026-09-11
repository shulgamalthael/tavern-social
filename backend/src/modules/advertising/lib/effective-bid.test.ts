import { describe, expect, it } from 'vitest';
import { calculateEffectiveCpmCents, DEFAULT_ASSUMED_CTR } from './effective-bid';

describe('calculateEffectiveCpmCents', () => {
  it('returns bidCents as-is for cpm campaigns, regardless of history', () => {
    expect(
      calculateEffectiveCpmCents({
        billingModel: 'cpm',
        bidCents: 500,
        impressionsServed: 1000,
        clicksServed: 50,
      }),
    ).toBe(500);
  });

  it('uses the assumed prior CTR for a cpc campaign with no impressions yet', () => {
    const result = calculateEffectiveCpmCents({
      billingModel: 'cpc',
      bidCents: 1000,
      impressionsServed: 0,
      clicksServed: 0,
    });
    expect(result).toBe(1000 * DEFAULT_ASSUMED_CTR * 1000);
  });

  it('uses the real observed CTR once a cpc campaign has impression history', () => {
    // 100 clicks / 1000 impressions = 10% CTR
    const result = calculateEffectiveCpmCents({
      billingModel: 'cpc',
      bidCents: 200,
      impressionsServed: 1000,
      clicksServed: 100,
    });
    expect(result).toBe(200 * 0.1 * 1000);
  });

  it('a cpc campaign with real CTR below the assumed prior ranks lower than its raw bid would suggest', () => {
    // 1 click / 10000 impressions = 0.01% CTR — much lower than the 1% prior
    const result = calculateEffectiveCpmCents({
      billingModel: 'cpc',
      bidCents: 100000,
      impressionsServed: 10000,
      clicksServed: 1,
    });
    expect(result).toBeCloseTo(100000 * 0.0001 * 1000, 5);
  });
});
