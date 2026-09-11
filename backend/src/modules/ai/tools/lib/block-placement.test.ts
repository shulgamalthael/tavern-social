import { describe, expect, it } from 'vitest';
import { assertIsContainer, findDisallowedChild, findMissingCapabilities } from './block-placement';

describe('assertIsContainer', () => {
  it('does not throw for a real container type', () => {
    expect(() => assertIsContainer('parent-id', 'section')).not.toThrow();
    expect(() => assertIsContainer('parent-id', 'columns')).not.toThrow();
  });

  it('throws (naming the block id) for a non-container type', () => {
    expect(() => assertIsContainer('block-42', 'heading')).toThrow(/"block-42".*не контейнер/);
  });

  it('throws for a type outside the allowlist entirely', () => {
    expect(() => assertIsContainer('block-1', 'not-a-real-type')).toThrow(/не может содержать/);
  });
});

describe('findDisallowedChild', () => {
  it('returns null when the parent has no child restriction', () => {
    expect(findDisallowedChild('section', ['heading', 'text'])).toBeNull();
  });

  it('returns null when every child type is allowed', () => {
    expect(findDisallowedChild('columns', ['column', 'column'])).toBeNull();
  });

  it('returns the first disallowed type plus a formatted allowed list', () => {
    const result = findDisallowedChild('columns', ['column', 'heading']);
    expect(result).not.toBeNull();
    expect(result!.disallowedType).toBe('heading');
    expect(result!.allowedTypesList).toContain('column');
  });

  it('treats a type outside the allowlist as disallowed too', () => {
    const result = findDisallowedChild('columns', ['not-a-real-type']);
    expect(result?.disallowedType).toBe('not-a-real-type');
  });
});

describe('findMissingCapabilities', () => {
  it('returns nothing when no block type requires a capability', () => {
    expect(findMissingCapabilities(['heading', 'text'], [])).toEqual([]);
  });

  it('returns the missing capability for a gated block type', () => {
    expect(findMissingCapabilities(['productgrid'], [])).toEqual(['commerce']);
  });

  it('returns nothing once the business already has the capability', () => {
    expect(findMissingCapabilities(['productgrid'], ['commerce'])).toEqual([]);
  });

  it('deduplicates when several block types require the same capability', () => {
    // productgrid — единственный сегодня curated-тип с capability 'commerce',
    // проверяем дедупликацию через два вхождения одного и того же типа.
    expect(findMissingCapabilities(['productgrid', 'productgrid'], [])).toEqual(['commerce']);
  });

  it('ignores an unrecognized block type instead of throwing', () => {
    expect(findMissingCapabilities(['not-a-real-type'], [])).toEqual([]);
  });
});
