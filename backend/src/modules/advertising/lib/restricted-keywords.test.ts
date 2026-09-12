import { describe, expect, it } from 'vitest';
import { findRestrictedKeywordMatch } from './restricted-keywords';

describe('findRestrictedKeywordMatch', () => {
  it('finds a match in headline text', () => {
    const result = findRestrictedKeywordMatch('Скидка на пиво 20%', null);
    expect(result).toEqual({ topic: 'Алкоголь', keyword: 'пиво' });
  });

  it('finds a match in description when headline is clean', () => {
    const result = findRestrictedKeywordMatch('Скидки', 'Заходи в наше казино онлайн');
    expect(result).toEqual({ topic: 'Азарт/гэмблинг', keyword: 'казино' });
  });

  it('is case-insensitive', () => {
    const result = findRestrictedKeywordMatch('CASINO Royale', null);
    expect(result).toEqual({ topic: 'Азарт/гэмблинг', keyword: 'casino' });
  });

  it('returns null for clean text', () => {
    expect(findRestrictedKeywordMatch('Скидка 20% на кофе', 'Только сегодня')).toBeNull();
  });

  it('ignores null/undefined inputs without throwing', () => {
    expect(findRestrictedKeywordMatch(null, undefined)).toBeNull();
  });

  it('matches an English keyword', () => {
    const result = findRestrictedKeywordMatch('Best vodka in town', null);
    expect(result).toEqual({ topic: 'Алкоголь', keyword: 'vodka' });
  });
});
