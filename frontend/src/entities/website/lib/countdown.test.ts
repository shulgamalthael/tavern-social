import { describe, expect, it } from 'vitest';
import { formatCountdownCompact, getCountdownParts } from './countdown';

const NOW = new Date('2026-01-01T00:00:00.000Z');

describe('getCountdownParts', () => {
  it('splits a future date into days/hours/minutes/seconds', () => {
    const target = '2026-01-03T01:02:03.000Z'; // +2d 1h 2m 3s
    expect(getCountdownParts(target, NOW)).toEqual({
      days: 2,
      hours: 1,
      minutes: 2,
      seconds: 3,
      isPast: false,
    });
  });

  it('treats a past date as expired, not negative numbers', () => {
    expect(getCountdownParts('2025-01-01T00:00:00.000Z', NOW)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isPast: true,
    });
  });

  it('treats the exact target instant as expired (no off-by-one flash of 0/0/0/0 "not past")', () => {
    expect(getCountdownParts(NOW.toISOString(), NOW).isPast).toBe(true);
  });

  it('treats an unparsable date string as expired instead of throwing', () => {
    expect(getCountdownParts('not-a-date', NOW)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isPast: true,
    });
  });

  it('treats an empty string as expired', () => {
    expect(getCountdownParts('', NOW).isPast).toBe(true);
  });
});

describe('formatCountdownCompact', () => {
  it('pads hours/minutes/seconds but not days', () => {
    expect(
      formatCountdownCompact({ days: 12, hours: 4, minutes: 33, seconds: 2, isPast: false }),
    ).toBe('12д 04ч 33м 02с');
  });

  it('returns an empty string once expired', () => {
    expect(
      formatCountdownCompact({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true }),
    ).toBe('');
  });
});
