import { describe, expect, it } from 'vitest';
import {
  computeCapacityStatus,
  computeForecast,
  isRateAnomaly,
  percentOfSafetyLimit,
  shouldAdmit,
  type DailyUsagePoint,
} from './ai-capacity.lib';

describe('percentOfSafetyLimit', () => {
  it('computes percentage against the safety limit, not the official limit', () => {
    expect(percentOfSafetyLimit(6, 12)).toBe(50);
  });

  it('returns 0 when safety limit is non-positive (avoids division by zero)', () => {
    expect(percentOfSafetyLimit(5, 0)).toBe(0);
  });
});

describe('computeCapacityStatus', () => {
  it('classifies each band correctly', () => {
    expect(computeCapacityStatus(50, 70, 85, 95)).toBe('normal');
    expect(computeCapacityStatus(70, 70, 85, 95)).toBe('warning');
    expect(computeCapacityStatus(85, 70, 85, 95)).toBe('critical');
    expect(computeCapacityStatus(95, 70, 85, 95)).toBe('emergency');
    expect(computeCapacityStatus(100, 70, 85, 95)).toBe('emergency');
  });
});

describe('shouldAdmit', () => {
  it('admits everything under normal/warning', () => {
    expect(shouldAdmit('low', 'normal')).toBe(true);
    expect(shouldAdmit('low', 'warning')).toBe(true);
  });

  it('critical blocks only low priority', () => {
    expect(shouldAdmit('high', 'critical')).toBe(true);
    expect(shouldAdmit('medium', 'critical')).toBe(true);
    expect(shouldAdmit('low', 'critical')).toBe(false);
  });

  it('emergency admits only high priority', () => {
    expect(shouldAdmit('high', 'emergency')).toBe(true);
    expect(shouldAdmit('medium', 'emergency')).toBe(false);
    expect(shouldAdmit('low', 'emergency')).toBe(false);
  });
});

function points(counts: number[]): DailyUsagePoint[] {
  return counts.map((requestCount, index) => ({
    date: `2026-08-${String(index + 1).padStart(2, '0')}`,
    requestCount,
  }));
}

describe('computeForecast', () => {
  it('reports insufficient data below minDataPoints', () => {
    const result = computeForecast(points([10, 12]), 100, 3);
    expect(result.sufficientData).toBe(false);
    expect(result.daysUntilCapacityInsufficient).toBeNull();
  });

  it('reports insufficient data when dailyCapacity is non-positive', () => {
    const result = computeForecast(points([10, 12, 14]), 0);
    expect(result.sufficientData).toBe(false);
  });

  it('detects flat usage as already-at-capacity when latest exceeds capacity', () => {
    const result = computeForecast(points([50, 50, 50]), 40);
    expect(result.sufficientData).toBe(true);
    expect(result.daysUntilCapacityInsufficient).toBe(0);
  });

  it('projects forward under steady exponential growth and finds the crossover day', () => {
    // Exactly ×1.1/day for 5 days: 100 → 110 → 121 → 133 → 146
    const result = computeForecast(points([100, 110, 121, 133, 146]), 200);
    expect(result.sufficientData).toBe(true);
    expect(result.averageDailyGrowthPercent).toBeCloseTo(10, 0);
    expect(result.daysUntilCapacityInsufficient).not.toBeNull();
    expect(result.daysUntilCapacityInsufficient!).toBeGreaterThan(0);
  });

  it('returns null crossover day when usage is flat/declining and never reaches capacity', () => {
    const result = computeForecast(points([100, 100, 100, 100]), 1000);
    expect(result.sufficientData).toBe(true);
    expect(result.daysUntilCapacityInsufficient).toBeNull();
  });
});

describe('isRateAnomaly', () => {
  it('flags a rate well above the baseline multiplier', () => {
    expect(isRateAnomaly(18, 2, 5)).toBe(true);
  });

  it('does not flag a rate within normal bounds', () => {
    expect(isRateAnomaly(3, 2, 5)).toBe(false);
  });

  it('falls back to the multiplier as an absolute floor when there is no baseline yet', () => {
    expect(isRateAnomaly(10, 0, 5)).toBe(true);
    expect(isRateAnomaly(4, 0, 5)).toBe(false);
  });
});
