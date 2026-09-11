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

  it('accepts the ten types added by the competitor-widget-library batch', () => {
    expect(isAllowedBlockType('timeline')).toBe(true);
    expect(isAllowedBlockType('timelinesimple')).toBe(true);
    expect(isAllowedBlockType('tabs')).toBe(true);
    expect(isAllowedBlockType('tabsvertical')).toBe(true);
    expect(isAllowedBlockType('countdown')).toBe(true);
    expect(isAllowedBlockType('countdownbar')).toBe(true);
    expect(isAllowedBlockType('logocloud')).toBe(true);
    expect(isAllowedBlockType('logocloudmarquee')).toBe(true);
    expect(isAllowedBlockType('comparison')).toBe(true);
    expect(isAllowedBlockType('comparisonsplit')).toBe(true);
  });

  it('accepts entitysearch (the AI-widget-creation-track batch)', () => {
    expect(isAllowedBlockType('entitysearch')).toBe(true);
  });

  it('accepts the ten types added by the competitor-widget-library batch 2', () => {
    expect(isAllowedBlockType('imagecarousel')).toBe(true);
    expect(isAllowedBlockType('imagecarouselthumbs')).toBe(true);
    expect(isAllowedBlockType('beforeafter')).toBe(true);
    expect(isAllowedBlockType('beforeaftertabs')).toBe(true);
    expect(isAllowedBlockType('progressbars')).toBe(true);
    expect(isAllowedBlockType('progresscircles')).toBe(true);
    expect(isAllowedBlockType('stickybar')).toBe(true);
    expect(isAllowedBlockType('popupoffer')).toBe(true);
    expect(isAllowedBlockType('testimonialsslider')).toBe(true);
    expect(isAllowedBlockType('quotespotlight')).toBe(true);
  });

  it('accepts the ten types added by the competitor-widget-library batch 3', () => {
    expect(isAllowedBlockType('contactbubble')).toBe(true);
    expect(isAllowedBlockType('contactbubblemulti')).toBe(true);
    expect(isAllowedBlockType('statscounter')).toBe(true);
    expect(isAllowedBlockType('statscountericons')).toBe(true);
    expect(isAllowedBlockType('portfoliogrid')).toBe(true);
    expect(isAllowedBlockType('portfoliomasonry')).toBe(true);
    expect(isAllowedBlockType('gallerylightbox')).toBe(true);
    expect(isAllowedBlockType('gallerylightboxmasonry')).toBe(true);
    expect(isAllowedBlockType('cookiebar')).toBe(true);
    expect(isAllowedBlockType('cookiebarminimal')).toBe(true);
  });

  it('accepts the ten types added by the competitor-widget-library batch 4', () => {
    expect(isAllowedBlockType('steps')).toBe(true);
    expect(isAllowedBlockType('stepsicons')).toBe(true);
    expect(isAllowedBlockType('iconlist')).toBe(true);
    expect(isAllowedBlockType('iconlistinline')).toBe(true);
    expect(isAllowedBlockType('announcementbar')).toBe(true);
    expect(isAllowedBlockType('announcementbarmarquee')).toBe(true);
    expect(isAllowedBlockType('testimonialwall')).toBe(true);
    expect(isAllowedBlockType('pricingtoggle')).toBe(true);
    expect(isAllowedBlockType('socialproofbar')).toBe(true);
    expect(isAllowedBlockType('herovideo')).toBe(true);
  });

  it('accepts the ten types added by the competitor-widget-library batch 5', () => {
    expect(isAllowedBlockType('dividerlabel')).toBe(true);
    expect(isAllowedBlockType('dividericon')).toBe(true);
    expect(isAllowedBlockType('newsletterpopup')).toBe(true);
    expect(isAllowedBlockType('imagehotspot')).toBe(true);
    expect(isAllowedBlockType('pricingsingle')).toBe(true);
    expect(isAllowedBlockType('videotestimonial')).toBe(true);
    expect(isAllowedBlockType('ratingsummary')).toBe(true);
    expect(isAllowedBlockType('faqtabs')).toBe(true);
    expect(isAllowedBlockType('socialshare')).toBe(true);
    expect(isAllowedBlockType('herosplitform')).toBe(true);
  });

  it('accepts the ten types added by the competitor-widget-library batch 6', () => {
    expect(isAllowedBlockType('timelinemedia')).toBe(true);
    expect(isAllowedBlockType('scarcitybar')).toBe(true);
    expect(isAllowedBlockType('eventcountdown')).toBe(true);
    expect(isAllowedBlockType('proscons')).toBe(true);
    expect(isAllowedBlockType('teamsocial')).toBe(true);
    expect(isAllowedBlockType('pricingcalculator')).toBe(true);
    expect(isAllowedBlockType('accordionlist')).toBe(true);
    expect(isAllowedBlockType('locationslist')).toBe(true);
    expect(isAllowedBlockType('scrollprogress')).toBe(true);
    expect(isAllowedBlockType('backtotop')).toBe(true);
  });

  it('accepts the ten types added by the competitor-widget-library batch 7', () => {
    expect(isAllowedBlockType('businesshours')).toBe(true);
    expect(isAllowedBlockType('getdirections')).toBe(true);
    expect(isAllowedBlockType('dualcta')).toBe(true);
    expect(isAllowedBlockType('videotestimonialslider')).toBe(true);
    expect(isAllowedBlockType('couponcode')).toBe(true);
    expect(isAllowedBlockType('stickycountdownbar')).toBe(true);
    expect(isAllowedBlockType('calloutbox')).toBe(true);
    expect(isAllowedBlockType('videogallery')).toBe(true);
    expect(isAllowedBlockType('anchornav')).toBe(true);
    expect(isAllowedBlockType('exitintentpopup')).toBe(true);
  });

  it('accepts the ten types added by the competitor-widget-library batch 8', () => {
    expect(isAllowedBlockType('datatable')).toBe(true);
    expect(isAllowedBlockType('quizsingle')).toBe(true);
    expect(isAllowedBlockType('statshero')).toBe(true);
    expect(isAllowedBlockType('audioembed')).toBe(true);
    expect(isAllowedBlockType('imagecaption')).toBe(true);
    expect(isAllowedBlockType('platformratings')).toBe(true);
    expect(isAllowedBlockType('faqsearch')).toBe(true);
    expect(isAllowedBlockType('nativesharebutton')).toBe(true);
    expect(isAllowedBlockType('teamslider')).toBe(true);
    expect(isAllowedBlockType('scrollcue')).toBe(true);
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
    it('has exactly the same block count as the frontend registry (131 — 48 original + 10 from competitor-widget-library batch 1 + entitysearch + 10 from batch 2 + 10 from batch 3 + 10 from batch 4 + 10 from batch 5 + 10 from batch 6 + 10 from batch 7 + 10 from batch 8 + adslot + shapedivider)', () => {
      expect(ALLOWED_BLOCK_TYPES.length).toBe(131);
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
        'timeline',
        'timelinesimple',
        'tabs',
        'tabsvertical',
        'countdown',
        'countdownbar',
        'logocloud',
        'logocloudmarquee',
        'entitysearch',
        'imagecarousel',
        'imagecarouselthumbs',
        'beforeafter',
        'beforeaftertabs',
        'progressbars',
        'progresscircles',
        'stickybar',
        'popupoffer',
        'testimonialsslider',
        'quotespotlight',
        'comparison',
        'comparisonsplit',
        'entitysearch',
        'contactbubble',
        'contactbubblemulti',
        'statscounter',
        'statscountericons',
        'portfoliogrid',
        'portfoliomasonry',
        'gallerylightbox',
        'gallerylightboxmasonry',
        'cookiebar',
        'cookiebarminimal',
        'steps',
        'stepsicons',
        'iconlist',
        'iconlistinline',
        'announcementbar',
        'announcementbarmarquee',
        'testimonialwall',
        'pricingtoggle',
        'socialproofbar',
        'herovideo',
        'dividerlabel',
        'dividericon',
        'newsletterpopup',
        'imagehotspot',
        'pricingsingle',
        'videotestimonial',
        'ratingsummary',
        'faqtabs',
        'socialshare',
        'herosplitform',
        'timelinemedia',
        'scarcitybar',
        'eventcountdown',
        'proscons',
        'teamsocial',
        'pricingcalculator',
        'accordionlist',
        'locationslist',
        'scrollprogress',
        'backtotop',
        'businesshours',
        'getdirections',
        'dualcta',
        'videotestimonialslider',
        'couponcode',
        'stickycountdownbar',
        'calloutbox',
        'videogallery',
        'anchornav',
        'exitintentpopup',
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

    it('is correct for the competitor-widget-library batch (mixed presence)', () => {
      // timeline/tabs/comparison — plain text + booleans only.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.timeline)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.tabs)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.comparison)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.comparisonsplit)).toBe(false);
      // countdownbar — top-level `buttonUrl: linkTarget`.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.countdownbar)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.countdown)).toBe(false);
      // logocloud(marquee) — nested mediaAsset/linkTarget inside `items`.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.logocloud)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.logocloudmarquee)).toBe(true);
    });

    it('is false for entitysearch (sources reference entities by plain name/enum, not linkTarget/mediaAsset)', () => {
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.entitysearch)).toBe(false);
    });

    it('is correct for the competitor-widget-library batch 2 (mixed presence)', () => {
      // imagecarousel(thumbs)/beforeafter(tabs) — nested/top-level mediaAsset.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.imagecarousel)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.imagecarouselthumbs)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.beforeafter)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.beforeaftertabs)).toBe(true);
      // testimonialsslider — nested mediaAsset inside items.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.testimonialsslider)).toBe(true);
      // stickybar/popupoffer — top-level linkTarget (buttonUrl).
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.stickybar)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.popupoffer)).toBe(true);
      // progressbars/progresscircles/quotespotlight — plain text/numbers only.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.progressbars)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.progresscircles)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.quotespotlight)).toBe(false);
    });

    it('is correct for the competitor-widget-library batch 3 (mixed presence)', () => {
      // gallerylightbox(masonry)/portfoliogrid/portfoliomasonry — nested mediaAsset/linkTarget.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.gallerylightbox)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.gallerylightboxmasonry)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.portfoliogrid)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.portfoliomasonry)).toBe(true);
      // contactbubble(multi)/statscounter(icons)/cookiebar(minimal) — plain
      // enum/string/number fields only, no linkTarget/mediaAsset anywhere.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.contactbubble)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.contactbubblemulti)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.statscounter)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.statscountericons)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.cookiebar)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.cookiebarminimal)).toBe(false);
    });

    it('is correct for the competitor-widget-library batch 4 (mixed presence)', () => {
      // steps(icons)/iconlist(inline) — enum icon choice + plain strings only.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.steps)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.stepsicons)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.iconlist)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.iconlistinline)).toBe(false);
      // announcementbar — top-level linkTarget (linkUrl); the marquee variant
      // has no link field at all, only a list of plain-string messages.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.announcementbar)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.announcementbarmarquee)).toBe(false);
      // testimonialwall/socialproofbar — nested mediaAsset (photo) inside a list.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.testimonialwall)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.socialproofbar)).toBe(true);
      // pricingtoggle/herovideo — nested/top-level linkTarget + mediaAsset.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.pricingtoggle)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.herovideo)).toBe(true);
    });

    it('is correct for the competitor-widget-library batch 5 (mixed presence)', () => {
      // dividerlabel/dividericon — plain string/enum only.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.dividerlabel)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.dividericon)).toBe(false);
      // newsletterpopup — same FORM_FIELDS_SCHEMA shape as contactform/
      // newsletterform/simpleform (no linkTarget/mediaAsset field anywhere).
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.newsletterpopup)).toBe(false);
      // imagehotspot — top-level mediaAsset (image).
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.imagehotspot)).toBe(true);
      // pricingsingle — top-level linkTarget (buttonUrl).
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.pricingsingle)).toBe(true);
      // videotestimonial — embedUrl is a plain string (like `video.embedUrl`),
      // not a linkTarget/mediaAsset field.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.videotestimonial)).toBe(false);
      // ratingsummary/faqtabs/socialshare — plain strings/numbers/booleans only.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.ratingsummary)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.faqtabs)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.socialshare)).toBe(false);
      // herosplitform — same form-fields shape as newsletterpopup, no
      // linkTarget/mediaAsset field anywhere either.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.herosplitform)).toBe(false);
    });

    it('is correct for the competitor-widget-library batch 6 (mixed presence)', () => {
      // timelinemedia/teamsocial — nested mediaAsset (image/photo) inside a list.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.timelinemedia)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.teamsocial)).toBe(true);
      // pricingcalculator — top-level linkTarget (buttonUrl).
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.pricingcalculator)).toBe(true);
      // scarcitybar/eventcountdown/proscons/accordionlist/locationslist —
      // plain strings/numbers only, no linkTarget/mediaAsset anywhere.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.scarcitybar)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.eventcountdown)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.proscons)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.accordionlist)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.locationslist)).toBe(false);
      // scrollprogress/backtotop — enum/number only.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.scrollprogress)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.backtotop)).toBe(false);
    });

    it('is correct for the competitor-widget-library batch 7 (mixed presence)', () => {
      // businesshours/getdirections/couponcode/calloutbox/videogallery —
      // plain strings/enums/numbers only, no linkTarget/mediaAsset anywhere
      // (real business data like address/workingHours is read from
      // `business` context on the client, not stored in these props).
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.businesshours)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.getdirections)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.couponcode)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.calloutbox)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.videogallery)).toBe(false);
      // videotestimonialslider — embedUrl is a plain string (like
      // `videotestimonial.embedUrl`), not a linkTarget/mediaAsset field.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.videotestimonialslider)).toBe(false);
      // dualcta/anchornav — nested linkTarget inside a list.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.dualcta)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.anchornav)).toBe(true);
      // stickycountdownbar/exitintentpopup — top-level linkTarget (buttonUrl).
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.stickycountdownbar)).toBe(true);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.exitintentpopup)).toBe(true);
    });

    it('is correct for the competitor-widget-library batch 8 (mixed presence)', () => {
      // datatable/quizsingle/statshero — plain strings/numbers, even
      // datatable's nested rows[].cells[] list has no linkTarget/mediaAsset.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.datatable)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.quizsingle)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.statshero)).toBe(false);
      // audioembed — embedUrl is a plain string, not a linkTarget/mediaAsset.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.audioembed)).toBe(false);
      // imagecaption — top-level mediaAsset (image).
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.imagecaption)).toBe(true);
      // platformratings/faqsearch/nativesharebutton — plain strings/numbers only.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.platformratings)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.faqsearch)).toBe(false);
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.nativesharebutton)).toBe(false);
      // teamslider — nested mediaAsset (photo) inside a list.
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.teamslider)).toBe(true);
      // scrollcue — top-level linkTarget (url).
      expect(schemaNeedsRefs(BLOCK_SCHEMAS.scrollcue)).toBe(true);
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
