import { describe, expect, it } from 'vitest';
import {
  computeAvailableSlots,
  findConflict,
  isWithinWorkingHours,
  type ExistingAppointment,
} from './availability';

// 2026-08-31 — a Monday, per the calendar.
const MONDAY = (hours: number, minutes = 0) => new Date(2026, 7, 31, hours, minutes);
const SUNDAY = (hours: number, minutes = 0) => new Date(2026, 8, 6, hours, minutes);

describe('isWithinWorkingHours', () => {
  it('allows anything when workingHours is entirely unset (backward compatibility)', () => {
    expect(isWithinWorkingHours(null, MONDAY(3), MONDAY(4))).toBe(true);
  });

  it('rejects a day with no configured hours (closed)', () => {
    const hours = { tue: { open: '09:00', close: '18:00' } };
    expect(isWithinWorkingHours(hours, MONDAY(10), MONDAY(11))).toBe(false);
  });

  it('accepts a slot fully inside the configured window', () => {
    const hours = { mon: { open: '09:00', close: '18:00' } };
    expect(isWithinWorkingHours(hours, MONDAY(9), MONDAY(10))).toBe(true);
  });

  it('rejects a slot starting before opening', () => {
    const hours = { mon: { open: '09:00', close: '18:00' } };
    expect(isWithinWorkingHours(hours, MONDAY(8, 30), MONDAY(9, 30))).toBe(false);
  });

  it('rejects a slot ending after closing', () => {
    const hours = { mon: { open: '09:00', close: '18:00' } };
    expect(isWithinWorkingHours(hours, MONDAY(17, 30), MONDAY(18, 30))).toBe(false);
  });

  it('rejects a slot that crosses midnight into a different calendar day', () => {
    const hours = {
      mon: { open: '09:00', close: '18:00' },
      tue: { open: '09:00', close: '18:00' },
    };
    expect(isWithinWorkingHours(hours, MONDAY(23, 30), new Date(2026, 8, 1, 0, 30))).toBe(false);
  });
});

describe('findConflict', () => {
  it('finds no conflict against an empty schedule', () => {
    expect(findConflict(MONDAY(10), 30, [])).toBeUndefined();
  });

  it('detects a direct overlap', () => {
    const existing: ExistingAppointment[] = [{ startsAt: MONDAY(10), durationMinutes: 60 }];
    expect(findConflict(MONDAY(10, 30), 30, existing)).toBe(existing[0]);
  });

  it('does not flag back-to-back appointments as conflicting', () => {
    const existing: ExistingAppointment[] = [{ startsAt: MONDAY(10), durationMinutes: 60 }];
    expect(findConflict(MONDAY(11), 30, existing)).toBeUndefined();
  });

  it('detects an overlap even when the new appointment fully contains the existing one', () => {
    const existing: ExistingAppointment[] = [{ startsAt: MONDAY(10, 15), durationMinutes: 15 }];
    expect(findConflict(MONDAY(10), 60, existing)).toBe(existing[0]);
  });
});

describe('computeAvailableSlots', () => {
  it('returns an empty list for a day with no configured hours and no default (unrestricted business)', () => {
    // Unrestricted businesses still get the presentational 09:00-18:00
    // default (see `dayWindowFor`), so this exercises a business that HAS
    // configured hours but left this specific day closed.
    const slots = computeAvailableSlots({
      date: SUNDAY(0),
      durationMinutes: 30,
      workingHours: { mon: { open: '09:00', close: '18:00' } },
      existing: [],
      now: SUNDAY(0),
    });
    expect(slots).toEqual([]);
  });

  it('falls back to the 09:00-18:00 presentational default when no working hours are configured at all', () => {
    const slots = computeAvailableSlots({
      date: MONDAY(0),
      durationMinutes: 180,
      workingHours: null,
      existing: [],
      now: MONDAY(0),
    });
    expect(slots.map((slot) => slot.getHours())).toEqual([9, 12, 15]);
  });

  it('excludes slots that overlap an existing appointment', () => {
    const slots = computeAvailableSlots({
      date: MONDAY(0),
      durationMinutes: 60,
      workingHours: { mon: { open: '09:00', close: '12:00' } },
      existing: [{ startsAt: MONDAY(10), durationMinutes: 60 }],
      now: MONDAY(0),
    });
    expect(slots.map((slot) => slot.getHours())).toEqual([9, 11]);
  });

  it('excludes slots that have already passed', () => {
    const slots = computeAvailableSlots({
      date: MONDAY(0),
      durationMinutes: 60,
      workingHours: { mon: { open: '09:00', close: '12:00' } },
      existing: [],
      now: MONDAY(10, 30),
    });
    expect(slots.map((slot) => slot.getHours())).toEqual([11]);
  });
});
