import { describe, expect, it } from 'vitest';
import {
  isCandidateBlocked,
  selectPacedPostIds,
  type FeedCreatorContext,
} from './native-ad-feed.lib';

function creator(overrides: Partial<FeedCreatorContext> = {}): FeedCreatorContext {
  return {
    id: 'creator-1',
    maxAdFrequencyRatio: 5,
    blockedCategories: [],
    blockedAdvertiserIds: [],
    ...overrides,
  };
}

describe('selectPacedPostIds', () => {
  it('opens no ad slot before the ratio is reached', () => {
    const c = creator({ maxAdFrequencyRatio: 5 });
    const posts = ['p1', 'p2', 'p3', 'p4'].map((postId) => ({ postId, creator: c }));
    expect(selectPacedPostIds(posts)).toEqual([]);
  });

  it('opens a slot exactly on the Nth post and resets the counter', () => {
    const c = creator({ maxAdFrequencyRatio: 3 });
    const posts = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((postId) => ({ postId, creator: c }));
    // Слот открывается на 3-м посте, затем счётчик сбрасывается — следующий
    // слот только ещё через 3 поста (на 6-м), не на 4-м/5-м.
    expect(selectPacedPostIds(posts)).toEqual(['p3', 'p6']);
  });

  it('a ratio of 1 opens a slot on every single post', () => {
    const c = creator({ maxAdFrequencyRatio: 1 });
    const posts = ['p1', 'p2', 'p3'].map((postId) => ({ postId, creator: c }));
    expect(selectPacedPostIds(posts)).toEqual(['p1', 'p2', 'p3']);
  });

  it('paces each creator independently — one creator reaching the ratio does not affect another', () => {
    const alice = creator({ id: 'alice', maxAdFrequencyRatio: 2 });
    const bob = creator({ id: 'bob', maxAdFrequencyRatio: 2 });
    const posts = [
      { postId: 'a1', creator: alice },
      { postId: 'b1', creator: bob },
      { postId: 'a2', creator: alice },
      { postId: 'b2', creator: bob },
    ];
    expect(selectPacedPostIds(posts)).toEqual(['a2', 'b2']);
  });
});

describe('isCandidateBlocked', () => {
  it('is not blocked when the creator has no blocks at all', () => {
    expect(isCandidateBlocked({ adCategory: null, advertiserBusinessId: 'biz-1' }, creator())).toBe(
      false,
    );
  });

  it('blocks a specifically blocked advertiser', () => {
    expect(
      isCandidateBlocked(
        { adCategory: null, advertiserBusinessId: 'biz-1' },
        creator({ blockedAdvertiserIds: ['biz-1'] }),
      ),
    ).toBe(true);
  });

  it('blocks a campaign whose declared ad category the creator has blocked', () => {
    expect(
      isCandidateBlocked(
        { adCategory: 'alcohol', advertiserBusinessId: 'biz-2' },
        creator({ blockedCategories: ['alcohol'] }),
      ),
    ).toBe(true);
  });

  it('never blocks an unclassified (null adCategory) campaign by category, even with categories blocked', () => {
    expect(
      isCandidateBlocked(
        { adCategory: null, advertiserBusinessId: 'biz-3' },
        creator({ blockedCategories: ['alcohol', 'political'] }),
      ),
    ).toBe(false);
  });

  it('does not block a campaign in a different category than the ones blocked', () => {
    expect(
      isCandidateBlocked(
        { adCategory: 'financial', advertiserBusinessId: 'biz-4' },
        creator({ blockedCategories: ['alcohol'] }),
      ),
    ).toBe(false);
  });
});
