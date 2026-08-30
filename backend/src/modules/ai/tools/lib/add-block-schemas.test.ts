import { describe, expect, it } from 'vitest';
import { BLOCK_SCHEMAS, buildValidatedProps, isAllowedBlockType } from './add-block-schemas';

describe('isAllowedBlockType', () => {
  it('accepts the four curated types', () => {
    expect(isAllowedBlockType('heading')).toBe(true);
    expect(isAllowedBlockType('text')).toBe(true);
    expect(isAllowedBlockType('quote')).toBe(true);
    expect(isAllowedBlockType('spacer')).toBe(true);
  });

  it('rejects anything outside the allowlist', () => {
    expect(isAllowedBlockType('image')).toBe(false);
    expect(isAllowedBlockType('productgrid')).toBe(false);
    expect(isAllowedBlockType('')).toBe(false);
  });
});

describe('buildValidatedProps', () => {
  it('falls back to defaultProps entirely when no props are given', () => {
    expect(buildValidatedProps(BLOCK_SCHEMAS.spacer, undefined)).toEqual({ height: 'md' });
  });

  it('merges only the provided fields over the defaults', () => {
    expect(buildValidatedProps(BLOCK_SCHEMAS.heading, { text: 'Привет' })).toEqual({
      text: 'Привет',
      level: 'h2',
      size: 'md',
      color: 'default',
    });
  });

  it('rejects an unknown field instead of silently dropping or passing it through', () => {
    expect(() => buildValidatedProps(BLOCK_SCHEMAS.text, { html: '<script>' })).toThrow(
      /Неизвестные поля/,
    );
  });

  it('rejects an enum value outside the declared set', () => {
    expect(() => buildValidatedProps(BLOCK_SCHEMAS.heading, { level: 'h4' })).toThrow(
      /должно быть одним из/,
    );
  });

  it('rejects a non-string value for a string field', () => {
    expect(() => buildValidatedProps(BLOCK_SCHEMAS.text, { text: 42 })).toThrow(
      /должно быть строкой/,
    );
  });

  it('rejects a string field longer than its maxLength', () => {
    expect(() => buildValidatedProps(BLOCK_SCHEMAS.quote, { author: 'x'.repeat(201) })).toThrow(
      /не может быть длиннее/,
    );
  });

  it('accepts a string field exactly at its maxLength', () => {
    const author = 'x'.repeat(200);
    expect(buildValidatedProps(BLOCK_SCHEMAS.quote, { author }).author).toBe(author);
  });

  it('merges over a custom base instead of schema defaults (update_block_props use case)', () => {
    const existingProps = { text: 'Уже было', level: 'h1', size: 'lg', color: 'primary' };
    const patched = buildValidatedProps(
      BLOCK_SCHEMAS.heading,
      { text: 'Новый текст' },
      existingProps,
    );
    expect(patched).toEqual({ text: 'Новый текст', level: 'h1', size: 'lg', color: 'primary' });
  });
});
