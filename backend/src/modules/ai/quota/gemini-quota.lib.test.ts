import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  computeGeminiBackoffDelayMs,
  geminiRpdBucketKey,
  geminiRpmBucketKey,
  msUntilNextGeminiRpdReset,
  msUntilNextGeminiRpmBucket,
  parseGeminiRetryAfterMs,
} from './gemini-quota.lib';

describe('geminiRpdBucketKey / msUntilNextGeminiRpdReset', () => {
  it('uses Pacific time, not UTC, for the daily bucket key', () => {
    // 2026-08-30T06:59:59Z = 2026-08-29T23:59:59 America/Los_Angeles (PDT, UTC-7)
    const now = new Date('2026-08-30T06:59:59.000Z');
    expect(geminiRpdBucketKey(now)).toBe('2026-08-29');
    expect(msUntilNextGeminiRpdReset(now)).toBe(1000);
  });

  it('rolls over to the next Pacific-time day right after midnight', () => {
    const now = new Date('2026-08-30T07:00:00.000Z');
    expect(geminiRpdBucketKey(now)).toBe('2026-08-30');
    expect(msUntilNextGeminiRpdReset(now)).toBe(24 * 60 * 60 * 1000);
  });
});

describe('geminiRpmBucketKey / msUntilNextGeminiRpmBucket', () => {
  it('keeps the same bucket key within one minute', () => {
    const a = new Date('2026-08-30T12:00:00.000Z');
    const b = new Date('2026-08-30T12:00:59.999Z');
    expect(geminiRpmBucketKey(a)).toBe(geminiRpmBucketKey(b));
  });

  it('changes the bucket key across a minute boundary', () => {
    const a = new Date('2026-08-30T12:00:59.999Z');
    const b = new Date('2026-08-30T12:01:00.000Z');
    expect(geminiRpmBucketKey(a)).not.toBe(geminiRpmBucketKey(b));
  });

  it('reports the exact remaining time in the current window', () => {
    expect(msUntilNextGeminiRpmBucket(new Date('2026-08-30T12:01:00.000Z'))).toBe(60_000);
    expect(msUntilNextGeminiRpmBucket(new Date('2026-08-30T12:01:59.999Z'))).toBe(1);
  });
});

describe('computeGeminiBackoffDelayMs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('grows exponentially with attempt number and stays within [exp, exp + base)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(computeGeminiBackoffDelayMs(1, 1000)).toBe(1000);
    expect(computeGeminiBackoffDelayMs(2, 1000)).toBe(2000);
    expect(computeGeminiBackoffDelayMs(3, 1000)).toBe(4000);

    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(computeGeminiBackoffDelayMs(1, 1000)).toBeLessThan(2000);
    expect(computeGeminiBackoffDelayMs(1, 1000)).toBeGreaterThanOrEqual(1000);
  });
});

describe('parseGeminiRetryAfterMs', () => {
  it('parses a seconds-based Retry-After header', () => {
    expect(parseGeminiRetryAfterMs('5')).toBe(5000);
    expect(parseGeminiRetryAfterMs('0')).toBe(0);
  });

  it('returns null for a missing or unparseable header', () => {
    expect(parseGeminiRetryAfterMs(null)).toBeNull();
    expect(parseGeminiRetryAfterMs('not-a-value')).toBeNull();
  });
});
