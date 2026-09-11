import { describe, expect, it } from 'vitest';
import { AD_SLOT_ENTITLEMENTS, getAdSlotLimit } from './ad-entitlements';

describe('getAdSlotLimit', () => {
  it.each(Object.entries(AD_SLOT_ENTITLEMENTS))('%s tier returns %i slots', (tier, limit) => {
    expect(getAdSlotLimit(tier as keyof typeof AD_SLOT_ENTITLEMENTS)).toBe(limit);
  });

  it('treats a missing subscription (null tier) as free — 0 slots', () => {
    expect(getAdSlotLimit(null)).toBe(0);
  });

  it('free tier itself is 0 slots', () => {
    expect(AD_SLOT_ENTITLEMENTS.free).toBe(0);
  });
});
