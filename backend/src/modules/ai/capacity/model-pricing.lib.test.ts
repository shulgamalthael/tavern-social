import { describe, expect, it } from 'vitest';
import { calculateCostMicros, centsToMicros, microsToUsd } from './model-pricing.lib';

describe('calculateCostMicros', () => {
  it('returns null when no pricing is configured — never invents a cost', () => {
    expect(calculateCostMicros(undefined, 1000, 500)).toBeNull();
  });

  it('computes cost from input/output token prices per million', () => {
    const pricing = {
      model: 'test-model',
      inputPricePerMillionUsd: 1,
      outputPricePerMillionUsd: 4,
    };
    // 500_000 input tokens @ $1/M = $0.5; 250_000 output tokens @ $4/M = $1 → total $1.5
    expect(calculateCostMicros(pricing, 500_000, 250_000)).toBe(1_500_000);
  });

  it('handles zero tokens', () => {
    const pricing = {
      model: 'test-model',
      inputPricePerMillionUsd: 1,
      outputPricePerMillionUsd: 4,
    };
    expect(calculateCostMicros(pricing, 0, 0)).toBe(0);
  });
});

describe('microsToUsd / centsToMicros', () => {
  it('round-trips cleanly', () => {
    expect(microsToUsd(1_500_000)).toBe(1.5);
    expect(centsToMicros(150)).toBe(1_500_000);
  });
});
