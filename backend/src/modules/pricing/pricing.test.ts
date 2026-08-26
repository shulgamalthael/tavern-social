import { describe, expect, it } from 'vitest';
import { calculateOrderPricing, checkDiscountEligibility } from './pricing';

describe('calculateOrderPricing', () => {
  it('computes a plain subtotal with no discount and no tax', () => {
    const result = calculateOrderPricing({
      items: [{ priceCents: 2999, quantity: 2 }],
      taxRateBps: 0,
      taxMode: 'none',
    });
    expect(result).toEqual({
      subtotalCents: 5998,
      discountCents: 0,
      taxCents: 0,
      totalCents: 5998,
    });
  });

  it('applies a percentage discount to the subtotal', () => {
    const result = calculateOrderPricing({
      items: [{ priceCents: 10_000, quantity: 1 }],
      taxRateBps: 0,
      taxMode: 'none',
      discount: { type: 'percentage', value: 20 },
    });
    expect(result).toEqual({
      subtotalCents: 10_000,
      discountCents: 2000,
      taxCents: 0,
      totalCents: 8000,
    });
  });

  it('applies a fixed discount, clamped so it never exceeds the subtotal', () => {
    const result = calculateOrderPricing({
      items: [{ priceCents: 500, quantity: 1 }],
      taxRateBps: 0,
      taxMode: 'none',
      discount: { type: 'fixed', value: 10_000 },
    });
    expect(result).toEqual({ subtotalCents: 500, discountCents: 500, taxCents: 0, totalCents: 0 });
  });

  it('adds exclusive tax on top of the post-discount amount', () => {
    const result = calculateOrderPricing({
      items: [{ priceCents: 10_000, quantity: 1 }],
      taxRateBps: 2000, // 20%
      taxMode: 'exclusive',
      discount: { type: 'percentage', value: 50 },
    });
    // subtotal 10000 -> discount 5000 -> taxable 5000 -> tax 1000 -> total 6000
    expect(result).toEqual({
      subtotalCents: 10_000,
      discountCents: 5000,
      taxCents: 1000,
      totalCents: 6000,
    });
  });

  it('computes inclusive tax for display only, without changing the total', () => {
    const result = calculateOrderPricing({
      items: [{ priceCents: 12_000, quantity: 1 }],
      taxRateBps: 2000, // 20%
      taxMode: 'inclusive',
    });
    // 12000 already includes 20% tax -> pre-tax = 10000, tax = 2000, total unchanged
    expect(result).toEqual({
      subtotalCents: 12_000,
      discountCents: 0,
      taxCents: 2000,
      totalCents: 12_000,
    });
  });

  it('charges no tax on an order fully covered by a discount', () => {
    const result = calculateOrderPricing({
      items: [{ priceCents: 1000, quantity: 1 }],
      taxRateBps: 2000,
      taxMode: 'exclusive',
      discount: { type: 'fixed', value: 1000 },
    });
    expect(result).toEqual({
      subtotalCents: 1000,
      discountCents: 1000,
      taxCents: 0,
      totalCents: 0,
    });
  });

  it('does not multiply by 100 for zero-decimal currencies (JPY) — operates purely on minor units', () => {
    const result = calculateOrderPricing({
      items: [{ priceCents: 500, quantity: 2 }],
      taxRateBps: 1000, // 10%
      taxMode: 'exclusive',
      discount: { type: 'percentage', value: 10 },
    });
    // subtotal 1000 -> discount 100 -> taxable 900 -> tax 90 -> total 990
    expect(result).toEqual({
      subtotalCents: 1000,
      discountCents: 100,
      taxCents: 90,
      totalCents: 990,
    });
  });
});

describe('checkDiscountEligibility', () => {
  const baseDiscount = {
    isActive: true,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    usageCount: 0,
    minOrderAmountCents: null,
  };

  it('accepts an unrestricted, active discount', () => {
    expect(checkDiscountEligibility(baseDiscount, 5000)).toBeNull();
  });

  it('rejects an inactive discount', () => {
    expect(checkDiscountEligibility({ ...baseDiscount, isActive: false }, 5000)).toBe('inactive');
  });

  it('rejects a discount that has not started yet', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const startsAt = new Date('2026-02-01T00:00:00Z');
    expect(checkDiscountEligibility({ ...baseDiscount, startsAt }, 5000, now)).toBe('not_started');
  });

  it('rejects an expired discount', () => {
    const now = new Date('2026-03-01T00:00:00Z');
    const endsAt = new Date('2026-02-01T00:00:00Z');
    expect(checkDiscountEligibility({ ...baseDiscount, endsAt }, 5000, now)).toBe('expired');
  });

  it('rejects a discount that reached its usage limit', () => {
    const discount = { ...baseDiscount, usageLimit: 5, usageCount: 5 };
    expect(checkDiscountEligibility(discount, 5000)).toBe('usage_limit_reached');
  });

  it('accepts a discount below its usage limit', () => {
    const discount = { ...baseDiscount, usageLimit: 5, usageCount: 4 };
    expect(checkDiscountEligibility(discount, 5000)).toBeNull();
  });

  it('rejects an order below the minimum amount', () => {
    const discount = { ...baseDiscount, minOrderAmountCents: 10_000 };
    expect(checkDiscountEligibility(discount, 5000)).toBe('min_order_not_met');
  });

  it('accepts an order that exactly meets the minimum amount', () => {
    const discount = { ...baseDiscount, minOrderAmountCents: 10_000 };
    expect(checkDiscountEligibility(discount, 10_000)).toBeNull();
  });
});
