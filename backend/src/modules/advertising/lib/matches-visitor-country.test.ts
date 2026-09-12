import { describe, expect, it } from 'vitest';
import { matchesVisitorCountry } from './matches-visitor-country';

describe('matchesVisitorCountry', () => {
  it('matches any visitor when the campaign has no country restriction', () => {
    expect(matchesVisitorCountry([], 'US')).toBe(true);
    expect(matchesVisitorCountry([], null)).toBe(true);
  });

  it('matches a visitor whose country is in the target list', () => {
    expect(matchesVisitorCountry(['US', 'UA'], 'UA')).toBe(true);
  });

  it('does not match a visitor whose country is not in the target list', () => {
    expect(matchesVisitorCountry(['US', 'UA'], 'DE')).toBe(false);
  });

  it('does not match an unresolvable visitor country against a restricted campaign', () => {
    expect(matchesVisitorCountry(['US'], null)).toBe(false);
    expect(matchesVisitorCountry(['US'], undefined)).toBe(false);
  });
});
