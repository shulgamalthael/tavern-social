import { describe, expect, it } from 'vitest';
import { evaluateConditions } from './rule-condition.lib';
import type { RuleCondition, RuleConditionNode } from './rules.types';

describe('evaluateConditions', () => {
  it('matches everything when there are no conditions', () => {
    expect(evaluateConditions(null, {})).toBe(true);
    expect(evaluateConditions([], { totalCents: 100 })).toBe(true);
  });

  it('evaluates a single numeric comparison', () => {
    const conditions: RuleCondition[] = [{ field: 'totalCents', operator: 'gte', value: 5000 }];
    expect(evaluateConditions(conditions, { totalCents: 5000 })).toBe(true);
    expect(evaluateConditions(conditions, { totalCents: 4999 })).toBe(false);
  });

  it('requires ALL conditions to match (AND-only composition)', () => {
    const conditions: RuleCondition[] = [
      { field: 'totalCents', operator: 'gte', value: 5000 },
      { field: 'currency', operator: 'eq', value: 'UAH' },
    ];
    expect(evaluateConditions(conditions, { totalCents: 6000, currency: 'UAH' })).toBe(true);
    expect(evaluateConditions(conditions, { totalCents: 6000, currency: 'USD' })).toBe(false);
  });

  it('supports eq/neq on strings and booleans, not just numbers', () => {
    expect(
      evaluateConditions([{ field: 'status', operator: 'eq', value: 'paid' }], { status: 'paid' }),
    ).toBe(true);
    expect(
      evaluateConditions([{ field: 'isTest', operator: 'neq', value: true }], { isTest: false }),
    ).toBe(true);
  });

  it('resolves a dot-path into a nested context', () => {
    const conditions: RuleCondition[] = [{ field: 'order.totalCents', operator: 'gt', value: 100 }];
    expect(evaluateConditions(conditions, { order: { totalCents: 200 } })).toBe(true);
    expect(evaluateConditions(conditions, { order: { totalCents: 50 } })).toBe(false);
  });

  it('treats a missing field as non-matching rather than throwing', () => {
    const conditions: RuleCondition[] = [{ field: 'missing.path', operator: 'gt', value: 1 }];
    expect(evaluateConditions(conditions, {})).toBe(false);
  });

  it('never coerces types for numeric comparisons — a string value never beats a numeric operator', () => {
    const conditions: RuleCondition[] = [{ field: 'totalCents', operator: 'gt', value: '5000' }];
    expect(evaluateConditions(conditions, { totalCents: 6000 })).toBe(false);
  });

  it('evaluates an "any" group as OR of its children', () => {
    const conditions: RuleConditionNode[] = [
      {
        any: [
          { field: 'currency', operator: 'eq', value: 'UAH' },
          { field: 'currency', operator: 'eq', value: 'USD' },
        ],
      },
    ];
    expect(evaluateConditions(conditions, { currency: 'USD' })).toBe(true);
    expect(evaluateConditions(conditions, { currency: 'EUR' })).toBe(false);
  });

  it('evaluates an "all" group as AND of its children, same as the top level', () => {
    const conditions: RuleConditionNode[] = [
      {
        all: [
          { field: 'totalCents', operator: 'gte', value: 1000 },
          { field: 'status', operator: 'eq', value: 'paid' },
        ],
      },
    ];
    expect(evaluateConditions(conditions, { totalCents: 2000, status: 'paid' })).toBe(true);
    expect(evaluateConditions(conditions, { totalCents: 2000, status: 'pending' })).toBe(false);
  });

  it('supports groups nested inside groups, to arbitrary depth', () => {
    const conditions: RuleConditionNode[] = [
      {
        any: [
          { field: 'currency', operator: 'eq', value: 'UAH' },
          {
            all: [
              { field: 'currency', operator: 'eq', value: 'USD' },
              { field: 'totalCents', operator: 'gte', value: 10000 },
            ],
          },
        ],
      },
    ];
    // First branch of the OR matches directly.
    expect(evaluateConditions(conditions, { currency: 'UAH', totalCents: 1 })).toBe(true);
    // Second branch (nested AND) matches when both its own children match.
    expect(evaluateConditions(conditions, { currency: 'USD', totalCents: 20000 })).toBe(true);
    // Second branch fails when only one of its children matches.
    expect(evaluateConditions(conditions, { currency: 'USD', totalCents: 1 })).toBe(false);
    // Neither branch matches.
    expect(evaluateConditions(conditions, { currency: 'EUR', totalCents: 20000 })).toBe(false);
  });

  it('combines a top-level leaf and a top-level group with implicit AND', () => {
    const conditions: RuleConditionNode[] = [
      { field: 'status', operator: 'eq', value: 'paid' },
      {
        any: [
          { field: 'currency', operator: 'eq', value: 'UAH' },
          { field: 'currency', operator: 'eq', value: 'USD' },
        ],
      },
    ];
    expect(evaluateConditions(conditions, { status: 'paid', currency: 'UAH' })).toBe(true);
    expect(evaluateConditions(conditions, { status: 'pending', currency: 'UAH' })).toBe(false);
  });
});
