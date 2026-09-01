import { describe, expect, it } from 'vitest';
import { BLOCK_SCHEMAS, buildValidatedProps, isAllowedBlockType } from './add-block-schemas';

describe('isAllowedBlockType', () => {
  it('accepts the seven curated types', () => {
    expect(isAllowedBlockType('heading')).toBe(true);
    expect(isAllowedBlockType('text')).toBe(true);
    expect(isAllowedBlockType('quote')).toBe(true);
    expect(isAllowedBlockType('spacer')).toBe(true);
    expect(isAllowedBlockType('image')).toBe(true);
    expect(isAllowedBlockType('button')).toBe(true);
    expect(isAllowedBlockType('web3wallet')).toBe(true);
  });

  it('rejects anything outside the allowlist', () => {
    expect(isAllowedBlockType('gallery')).toBe(false);
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

  describe('mediaAsset field (image.src)', () => {
    it('falls back to null when no props are given', () => {
      expect(buildValidatedProps(BLOCK_SCHEMAS.image, undefined).src).toBeNull();
    });

    it('accepts a URL present in the pre-fetched media asset refs', () => {
      const refs = {
        pageIds: new Set<string>(),
        productIds: new Set<string>(),
        serviceIds: new Set<string>(),
        mediaAssetUrls: new Set(['/uploads/website/photo.jpg']),
      };
      const props = buildValidatedProps(
        BLOCK_SCHEMAS.image,
        { src: '/uploads/website/photo.jpg' },
        undefined,
        refs,
      );
      expect(props.src).toBe('/uploads/website/photo.jpg');
    });

    it('rejects a URL not present in the refs — the model cannot invent an upload', () => {
      const refs = {
        pageIds: new Set<string>(),
        productIds: new Set<string>(),
        serviceIds: new Set<string>(),
        mediaAssetUrls: new Set(['/uploads/website/real.jpg']),
      };
      expect(() =>
        buildValidatedProps(
          BLOCK_SCHEMAS.image,
          { src: '/uploads/website/fake.jpg' },
          undefined,
          refs,
        ),
      ).toThrow(/должно быть null или ссылкой на уже загруженный файл/);
    });

    it('rejects a URL when no refs were provided at all (defaults to empty)', () => {
      expect(() =>
        buildValidatedProps(BLOCK_SCHEMAS.image, { src: '/uploads/website/photo.jpg' }),
      ).toThrow(/должно быть null или ссылкой на уже загруженный файл/);
    });
  });

  describe('linkTarget field (image.link / button.url)', () => {
    it('falls back to the empty external link when no props are given', () => {
      expect(buildValidatedProps(BLOCK_SCHEMAS.button, undefined).url).toEqual({
        type: 'external',
        url: '',
      });
    });

    it('accepts a well-formed external link', () => {
      const props = buildValidatedProps(BLOCK_SCHEMAS.button, {
        url: { type: 'external', url: 'https://example.com' },
      });
      expect(props.url).toEqual({ type: 'external', url: 'https://example.com' });
    });

    it('rejects an unknown link type', () => {
      expect(() =>
        buildValidatedProps(BLOCK_SCHEMAS.button, { url: { type: 'teleport' } }),
      ).toThrow(/url.type должен быть одним из/);
    });

    it('accepts addToCart pointing at a real product id', () => {
      const refs = {
        pageIds: new Set<string>(),
        productIds: new Set(['prod-1']),
        serviceIds: new Set<string>(),
        mediaAssetUrls: new Set<string>(),
      };
      const props = buildValidatedProps(
        BLOCK_SCHEMAS.button,
        { url: { type: 'addToCart', productId: 'prod-1' } },
        undefined,
        refs,
      );
      expect(props.url).toEqual({ type: 'addToCart', productId: 'prod-1' });
    });

    it('rejects addToCart pointing at a product id that does not exist', () => {
      const refs = {
        pageIds: new Set<string>(),
        productIds: new Set(['prod-1']),
        serviceIds: new Set<string>(),
        mediaAssetUrls: new Set<string>(),
      };
      expect(() =>
        buildValidatedProps(
          BLOCK_SCHEMAS.button,
          { url: { type: 'addToCart', productId: 'made-up' } },
          undefined,
          refs,
        ),
      ).toThrow(/должен ссылаться на существующий товар/);
    });

    it('rejects an email link with an invalid email', () => {
      expect(() =>
        buildValidatedProps(BLOCK_SCHEMAS.button, {
          url: { type: 'email', email: 'not-an-email' },
        }),
      ).toThrow(/должен быть корректным email/);
    });
  });

  describe('number field (web3wallet.nftLimit)', () => {
    it('falls back to the default when no props are given', () => {
      expect(buildValidatedProps(BLOCK_SCHEMAS.web3wallet, undefined)).toEqual({
        eyebrow: 'WEB3',
        heading: 'Наш кошелёк',
        description: '',
        nftLimit: 6,
      });
    });

    it('accepts a value within range, no refs needed', () => {
      const props = buildValidatedProps(BLOCK_SCHEMAS.web3wallet, { nftLimit: 12 });
      expect(props.nftLimit).toBe(12);
    });

    it('rejects a non-number value', () => {
      expect(() => buildValidatedProps(BLOCK_SCHEMAS.web3wallet, { nftLimit: '12' })).toThrow(
        /должно быть числом/,
      );
    });

    it('rejects a value below min', () => {
      expect(() => buildValidatedProps(BLOCK_SCHEMAS.web3wallet, { nftLimit: -1 })).toThrow(
        /не может быть меньше/,
      );
    });

    it('rejects a value above max', () => {
      expect(() => buildValidatedProps(BLOCK_SCHEMAS.web3wallet, { nftLimit: 25 })).toThrow(
        /не может быть больше/,
      );
    });

    it('accepts the boundary values exactly', () => {
      expect(buildValidatedProps(BLOCK_SCHEMAS.web3wallet, { nftLimit: 0 }).nftLimit).toBe(0);
      expect(buildValidatedProps(BLOCK_SCHEMAS.web3wallet, { nftLimit: 24 }).nftLimit).toBe(24);
    });
  });
});
