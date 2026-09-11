import { describe, expect, it } from 'vitest';
import {
  rankCreatorMatches,
  scoreCreatorMatch,
  type CampaignTargeting,
  type CreatorMatchProfile,
} from './creator-matching.lib';

function profile(overrides: Partial<CreatorMatchProfile> = {}): CreatorMatchProfile {
  return {
    creatorProfileId: 'creator-1',
    categoryIds: [],
    primaryCategoryId: null,
    city: null,
    audienceSize: 2000,
    ...overrides,
  };
}

const NO_TARGETING: CampaignTargeting = { targetCategoryIds: [], targetGeography: [] };

describe('scoreCreatorMatch', () => {
  it('scores a perfect match (primary category + matching city) at 100%', () => {
    const campaign: CampaignTargeting = {
      targetCategoryIds: ['gaming'],
      targetGeography: ['Киев'],
    };
    const result = scoreCreatorMatch(
      campaign,
      profile({ primaryCategoryId: 'gaming', categoryIds: ['gaming'], city: 'Киев' }),
    );
    expect(result.matchPercent).toBe(100);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Основная категория'),
        expect.stringContaining('География совпадает'),
      ]),
    );
  });

  it('an untargeted campaign (no category/geography filter) scores every creator at 100%', () => {
    const result = scoreCreatorMatch(NO_TARGETING, profile());
    expect(result.matchPercent).toBe(100);
  });

  it('scores a secondary-category match lower than a primary-category match', () => {
    const campaign: CampaignTargeting = { targetCategoryIds: ['gaming'], targetGeography: [] };
    const primaryMatch = scoreCreatorMatch(
      campaign,
      profile({ primaryCategoryId: 'gaming', categoryIds: ['gaming'] }),
    );
    const secondaryMatch = scoreCreatorMatch(
      campaign,
      profile({ primaryCategoryId: 'music', categoryIds: ['music', 'gaming'] }),
    );
    expect(secondaryMatch.score).toBeLessThan(primaryMatch.score);
  });

  it('scores a category mismatch at 0 for the category component (city still untargeted)', () => {
    const campaign: CampaignTargeting = { targetCategoryIds: ['gaming'], targetGeography: [] };
    const result = scoreCreatorMatch(
      campaign,
      profile({ primaryCategoryId: 'finance', categoryIds: ['finance'] }),
    );
    // category weight 0.6 * 0 + geography weight 0.4 * 1 (untargeted) = 0.4
    expect(result.score).toBeCloseTo(0.4, 5);
    expect(result.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining('Категории не совпадают')]),
    );
  });

  it('geography mismatch does not zero out an otherwise strong category match', () => {
    const campaign: CampaignTargeting = {
      targetCategoryIds: ['gaming'],
      targetGeography: ['Львов'],
    };
    const result = scoreCreatorMatch(
      campaign,
      profile({ primaryCategoryId: 'gaming', categoryIds: ['gaming'], city: 'Одесса' }),
    );
    // category weight 0.6 * 1 + geography weight 0.4 * 0.2 (no match, not zero) = 0.68
    expect(result.score).toBeCloseTo(0.68, 5);
  });

  it('city comparison is case-insensitive and trims whitespace', () => {
    const campaign: CampaignTargeting = { targetCategoryIds: [], targetGeography: [' киев '] };
    const result = scoreCreatorMatch(campaign, profile({ city: 'Киев' }));
    expect(result.matchPercent).toBe(100);
  });

  it('always includes an audience-size reason, regardless of match quality', () => {
    const result = scoreCreatorMatch(NO_TARGETING, profile({ audienceSize: 3500 }));
    // `toLocaleString('ru-RU')` uses a non-breaking space (U+00A0) as the
    // thousands separator, not a regular space — match loosely on the digits.
    expect(result.reasons.some((reason) => /3.?500/.test(reason))).toBe(true);
  });
});

describe('rankCreatorMatches', () => {
  it('sorts creators by descending score', () => {
    const campaign: CampaignTargeting = { targetCategoryIds: ['gaming'], targetGeography: [] };
    const results = rankCreatorMatches(campaign, [
      profile({ creatorProfileId: 'no-match', primaryCategoryId: 'finance' }),
      profile({ creatorProfileId: 'primary-match', primaryCategoryId: 'gaming' }),
      profile({
        creatorProfileId: 'secondary-match',
        primaryCategoryId: 'music',
        categoryIds: ['music', 'gaming'],
      }),
    ]);
    expect(results.map((r) => r.creatorProfileId)).toEqual([
      'primary-match',
      'secondary-match',
      'no-match',
    ]);
  });
});
