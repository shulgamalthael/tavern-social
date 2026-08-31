import { describe, expect, it } from 'vitest';
import { buildRuleSummary, parseRuleActions, parseRuleCondition } from './rules.types';

describe('parseRuleCondition', () => {
  it('treats null/undefined as "no condition"', () => {
    expect(parseRuleCondition(null)).toBeNull();
    expect(parseRuleCondition(undefined)).toBeNull();
  });

  it('rejects a non-array', () => {
    expect(() => parseRuleCondition('nope')).toThrow('массивом или отсутствовать');
  });

  it('parses a flat array of leaves unchanged, same as before groups existed', () => {
    const result = parseRuleCondition([{ field: 'totalCents', operator: 'gte', value: 5000 }]);
    expect(result).toEqual([{ field: 'totalCents', operator: 'gte', value: 5000 }]);
  });

  it('parses a top-level "any" group', () => {
    const result = parseRuleCondition([
      {
        any: [
          { field: 'currency', operator: 'eq', value: 'UAH' },
          { field: 'currency', operator: 'eq', value: 'USD' },
        ],
      },
    ]);
    expect(result).toEqual([
      {
        any: [
          { field: 'currency', operator: 'eq', value: 'UAH' },
          { field: 'currency', operator: 'eq', value: 'USD' },
        ],
      },
    ]);
  });

  it('parses groups nested inside groups', () => {
    const result = parseRuleCondition([
      {
        any: [
          { field: 'currency', operator: 'eq', value: 'UAH' },
          { all: [{ field: 'totalCents', operator: 'gte', value: 1000 }] },
        ],
      },
    ]);
    expect(result).toEqual([
      {
        any: [
          { field: 'currency', operator: 'eq', value: 'UAH' },
          { all: [{ field: 'totalCents', operator: 'gte', value: 1000 }] },
        ],
      },
    ]);
  });

  it('falls through to leaf validation for an object with neither "any"/"all" nor a valid leaf shape', () => {
    expect(() => parseRuleCondition([{ none: [] }])).toThrow('field должен быть непустой строкой');
  });

  it('rejects a group with both "any" and "all"', () => {
    expect(() =>
      parseRuleCondition([
        {
          any: [{ field: 'a', operator: 'eq', value: 1 }],
          all: [{ field: 'b', operator: 'eq', value: 2 }],
        },
      ]),
    ).toThrow('ровно одно из: any, all');
  });

  it('rejects an empty group', () => {
    expect(() => parseRuleCondition([{ any: [] }])).toThrow('непустым массивом');
  });

  it('rejects a malformed leaf inside a nested group, with a path pointing at it', () => {
    expect(() => parseRuleCondition([{ any: [{ field: '', operator: 'eq', value: 1 }] }])).toThrow(
      'condition[0].any[0].field',
    );
  });
});

describe('parseRuleActions', () => {
  it('rejects an empty array', () => {
    expect(() => parseRuleActions([])).toThrow('непустым массивом');
  });

  it('accepts send_notification unchanged', () => {
    expect(parseRuleActions([{ type: 'send_notification' }])).toEqual([
      { type: 'send_notification' },
    ]);
  });

  it('accepts add_loyalty_points with a valid integer points value', () => {
    expect(parseRuleActions([{ type: 'add_loyalty_points', points: 10 }])).toEqual([
      { type: 'add_loyalty_points', points: 10 },
    ]);
  });

  it('rejects add_loyalty_points with a non-integer points value', () => {
    expect(() => parseRuleActions([{ type: 'add_loyalty_points', points: 1.5 }])).toThrow(
      'points должен быть целым числом',
    );
  });

  it('rejects add_loyalty_points with zero or negative points', () => {
    expect(() => parseRuleActions([{ type: 'add_loyalty_points', points: 0 }])).toThrow(
      'points должен быть целым числом',
    );
  });

  it('rejects add_loyalty_points with points over the upper bound', () => {
    expect(() => parseRuleActions([{ type: 'add_loyalty_points', points: 1_000_001 }])).toThrow(
      'points должен быть целым числом',
    );
  });

  it('accepts set_membership_tier with a trimmed tier label', () => {
    expect(parseRuleActions([{ type: 'set_membership_tier', tier: '  gold  ' }])).toEqual([
      { type: 'set_membership_tier', tier: 'gold' },
    ]);
  });

  it('rejects set_membership_tier with an empty/whitespace-only tier', () => {
    expect(() => parseRuleActions([{ type: 'set_membership_tier', tier: '   ' }])).toThrow(
      'tier должен быть непустой строкой',
    );
  });

  it('rejects set_membership_tier with a tier over the length limit', () => {
    expect(() => parseRuleActions([{ type: 'set_membership_tier', tier: 'a'.repeat(41) }])).toThrow(
      'tier должен быть непустой строкой',
    );
  });

  it('rejects an unknown action type', () => {
    expect(() => parseRuleActions([{ type: 'delete_business' }])).toThrow('должен быть одним из');
  });
});

describe('buildRuleSummary', () => {
  it('summarizes order_completed with amount and currency', () => {
    expect(buildRuleSummary('order_completed', { totalCents: 150000, currency: 'UAH' })).toBe(
      'Новый заказ на 1500.00 UAH',
    );
  });

  it('falls back to a generic order summary when the amount is missing', () => {
    expect(buildRuleSummary('order_completed', {})).toBe('Новый заказ');
  });

  it('summarizes appointment_booked with service name and price', () => {
    expect(
      buildRuleSummary('appointment_booked', {
        serviceName: 'Стрижка',
        priceCents: 50000,
        currency: 'UAH',
      }),
    ).toBe('Новая запись: Стрижка (500.00 UAH)');
  });

  it('summarizes appointment_booked with just the service name when price is missing', () => {
    expect(buildRuleSummary('appointment_booked', { serviceName: 'Стрижка' })).toBe(
      'Новая запись: Стрижка',
    );
  });

  it('falls back to a generic appointment summary when the service name is missing', () => {
    expect(buildRuleSummary('appointment_booked', {})).toBe('Новая запись');
  });

  it('summarizes form_submitted with the form label', () => {
    expect(buildRuleSummary('form_submitted', { formLabel: 'Обратная связь' })).toBe(
      'Новая заявка: Обратная связь',
    );
  });

  it('falls back to a generic form summary when the label is missing', () => {
    expect(buildRuleSummary('form_submitted', {})).toBe('Новая заявка');
  });
});
