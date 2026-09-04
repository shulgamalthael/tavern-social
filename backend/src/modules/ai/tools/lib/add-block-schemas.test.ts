import { describe, expect, it } from 'vitest';
import {
  ALLOWED_BLOCK_TYPES,
  BLOCK_SCHEMAS,
  buildValidatedProps,
  isAllowedBlockType,
  schemaNeedsRefs,
} from './add-block-schemas';

const FULL_REFS = {
  pageIds: new Set<string>(),
  productIds: new Set<string>(),
  serviceIds: new Set<string>(),
  mediaAssetUrls: new Set<string>(['/uploads/website/photo.jpg']),
};

describe('isAllowedBlockType', () => {
  it('accepts the original seven curated types (still supported after the allowlist grew)', () => {
    expect(isAllowedBlockType('heading')).toBe(true);
    expect(isAllowedBlockType('text')).toBe(true);
    expect(isAllowedBlockType('quote')).toBe(true);
    expect(isAllowedBlockType('spacer')).toBe(true);
    expect(isAllowedBlockType('image')).toBe(true);
    expect(isAllowedBlockType('button')).toBe(true);
    expect(isAllowedBlockType('web3wallet')).toBe(true);
  });

  it('rejects anything outside the allowlist', () => {
    expect(isAllowedBlockType('notarealblocktype')).toBe(false);
    expect(isAllowedBlockType('productgrid-legacy')).toBe(false);
    expect(isAllowedBlockType('')).toBe(false);
  });

  it('now also accepts the previously-unsupported types added for full registry coverage', () => {
    expect(isAllowedBlockType('gallery')).toBe(true);
    expect(isAllowedBlockType('productgrid')).toBe(true);
    expect(isAllowedBlockType('hero')).toBe(true);
    expect(isAllowedBlockType('section')).toBe(true);
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

  describe('list field (gallery.images / pricing.plans / faq.items etc.)', () => {
    it('accepts a well-formed list of items', () => {
      const props = buildValidatedProps(
        BLOCK_SCHEMAS.gallery,
        { images: [{ url: '/uploads/website/photo.jpg' }] },
        undefined,
        FULL_REFS,
      );
      expect(props.images).toEqual([{ url: '/uploads/website/photo.jpg' }]);
    });

    it('rejects a non-array value', () => {
      expect(() => buildValidatedProps(BLOCK_SCHEMAS.gallery, { images: 'nope' })).toThrow(
        /должно быть массивом/,
      );
    });

    it('rejects more items than maxItems', () => {
      const tooMany = Array.from({ length: 25 }, () => ({ url: null }));
      expect(() => buildValidatedProps(BLOCK_SCHEMAS.gallery, { images: tooMany })).toThrow(
        /не может содержать больше 24 элементов/,
      );
    });

    it('rejects an unknown key inside a list item', () => {
      expect(() =>
        buildValidatedProps(BLOCK_SCHEMAS.gallery, { images: [{ url: null, caption: 'nope' }] }),
      ).toThrow(/Неизвестные поля в элементе 0/);
    });

    it('validates nested fields inside each item (e.g. boolean pricing.plans[].highlighted)', () => {
      const props = buildValidatedProps(BLOCK_SCHEMAS.pricing, {
        plans: [
          {
            name: 'Тест',
            price: '₴1',
            period: '',
            features: [{ text: 'Пункт' }],
            highlighted: true,
            buttonLabel: '',
            buttonUrl: { type: 'external', url: '' },
          },
        ],
      });
      expect(props.plans).toEqual([
        {
          name: 'Тест',
          price: '₴1',
          period: '',
          features: [{ text: 'Пункт' }],
          highlighted: true,
          buttonLabel: '',
          buttonUrl: { type: 'external', url: '' },
        },
      ]);
    });

    it('rejects a non-boolean value for a boolean list-item field', () => {
      expect(() =>
        buildValidatedProps(BLOCK_SCHEMAS.pricing, {
          plans: [
            {
              name: 'Тест',
              price: '',
              period: '',
              features: [],
              highlighted: 'yes',
              buttonLabel: '',
              buttonUrl: { type: 'external', url: '' },
            },
          ],
        }),
      ).toThrow(/должно быть true\/false/);
    });
  });

  describe('dataSource field (productgrid/servicegrid/bloggrid)', () => {
    it('accepts a well-formed {limit, sort}', () => {
      const props = buildValidatedProps(BLOCK_SCHEMAS.productgrid, {
        dataSource: { limit: 12, sort: 'price-asc' },
      });
      expect(props.dataSource).toEqual({ limit: 12, sort: 'price-asc' });
    });

    it('rejects a limit outside 1-24', () => {
      expect(() =>
        buildValidatedProps(BLOCK_SCHEMAS.productgrid, {
          dataSource: { limit: 0, sort: 'newest' },
        }),
      ).toThrow(/limit.*должно быть числом от 1 до 24/);
      expect(() =>
        buildValidatedProps(BLOCK_SCHEMAS.productgrid, {
          dataSource: { limit: 25, sort: 'newest' },
        }),
      ).toThrow(/limit.*должно быть числом от 1 до 24/);
    });

    it('rejects an unknown sort value', () => {
      expect(() =>
        buildValidatedProps(BLOCK_SCHEMAS.productgrid, {
          dataSource: { limit: 6, sort: 'random' },
        }),
      ).toThrow(/sort.*должно быть одним из/);
    });

    it('rejects an unexpected extra key', () => {
      expect(() =>
        buildValidatedProps(BLOCK_SCHEMAS.productgrid, {
          dataSource: { limit: 6, sort: 'newest', entity: 'product' },
        }),
      ).toThrow(/допускает только limit\/sort/);
    });
  });

  describe('every registered schema (full registry coverage)', () => {
    it('has exactly the same block count as the frontend registry (48)', () => {
      expect(ALLOWED_BLOCK_TYPES.length).toBe(48);
    });

    it.each(ALLOWED_BLOCK_TYPES)(
      '%s: defaultProps has exactly the keys declared in fields',
      (type) => {
        // Не полная валидация значений через `buildValidatedProps` — пара
        // блоков (`breadcrumbs`) намеренно держит ПУСТОЙ (`pageId: ''`/
        // `anchor: ''`) linkTarget-плейсхолдер в defaultProps, тот же самый,
        // что и у frontend-реестра (`EMPTY_LINK_TARGET`-подобный паттерн) —
        // такой плейсхолдер осознанно не проходит строгую проверку
        // `validateLinkTarget`, ждёт, что его заполнит пользователь/AI, и это
        // не баг транскрипции. Проверка ключей уже ловит подавляющее
        // большинство реальных опечаток (несовпадение имени поля между
        // `fields` и `defaultProps`), не давая ложных срабатываний на
        // осознанно неполных плейсхолдерах.
        const schema = BLOCK_SCHEMAS[type];
        expect(Object.keys(schema.defaultProps).sort()).toEqual(Object.keys(schema.fields).sort());
      },
    );

    it('spot-checks that a representative sample of defaultProps also passes full validation', () => {
      // Дополняет проверку ключей выше реальным прогоном через
      // `buildValidatedProps` там, где значения по умолчанию НЕ являются
      // намеренными пустыми плейсхолдерами (см. комментарий выше про
      // `breadcrumbs`) — ловит опечатки в САМИХ значениях (неверный enum,
      // число вне диапазона и т.п.), не только в именах ключей.
      const sample: (keyof typeof BLOCK_SCHEMAS)[] = [
        'hero',
        'cards',
        'team',
        'pricing',
        'faq',
        'productgrid',
        'servicegrid',
        'bloggrid',
        'businessheader',
        'footer',
        'gallery',
        'stats',
        'contactform',
      ];
      for (const type of sample) {
        const schema = BLOCK_SCHEMAS[type];
        expect(() =>
          buildValidatedProps(schema, schema.defaultProps, undefined, FULL_REFS),
        ).not.toThrow();
      }
    });
  });

  describe('schemaNeedsRefs (drives needsBlockRefs in build-block-refs.ts)', () => {
    it('is true for a block with a top-level mediaAsset/linkTarget field', () => {
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.hero)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.image)).toBe(true);
    });

    it('is true when the field is nested inside a list item (recursive)', () => {
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.cards)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.team)).toBe(true);
    });

    it('is false for a block with no linkTarget/mediaAsset fields anywhere', () => {
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.stats)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.section)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.productgrid)).toBe(false);
    });
  });

  describe('capability gate metadata (enforced in AddBlockTool, not here)', () => {
    it('is set for the three data-driven blocks', () => {
      expect(BLOCK_SCHEMAS.productgrid.capability).toBe('commerce');
      expect(BLOCK_SCHEMAS.servicegrid.capability).toBe('booking');
      expect(BLOCK_SCHEMAS.bloggrid.capability).toBe('content');
    });

    it('is unset for a regular block', () => {
      expect(BLOCK_SCHEMAS.hero.capability).toBeUndefined();
    });
  });
});
