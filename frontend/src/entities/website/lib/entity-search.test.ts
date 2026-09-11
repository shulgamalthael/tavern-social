import { describe, expect, it } from 'vitest';
import type { PublicBlogPost } from '@/entities/blog-post';
import type { PublicCustomEntity } from '@/entities/custom-entity';
import type { PublicProduct } from '@/entities/product';
import type { PublicService } from '@/entities/service';
import {
  buildCustomEntityResults,
  buildPostResults,
  buildProductResults,
  buildServiceResults,
  filterSearchResults,
} from './entity-search';

const PRODUCT: PublicProduct = {
  id: 'p1',
  name: 'Кожаный ремень',
  slug: 'kozhanyy-remen',
  description: 'Ручная работа, натуральная кожа',
  priceCents: 150000,
  currency: 'UAH',
  images: [],
  stock: 4,
};

const SERVICE: PublicService = {
  id: 's1',
  name: 'Стрижка',
  slug: 'strizhka',
  description: 'Классическая мужская стрижка',
  durationMinutes: 40,
  priceCents: 30000,
  currency: 'UAH',
  images: [],
};

const POST: PublicBlogPost = {
  id: 'b1',
  title: 'Как ухаживать за кожей',
  slug: 'kak-uhazhivat-za-kozhey',
  excerpt: 'Несколько простых советов',
  content: '',
  coverImage: null,
  seoTitle: null,
  seoDescription: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('buildProductResults', () => {
  it('builds a result with a formatted price subtitle and searchable name+description', () => {
    const [result] = buildProductResults([PRODUCT]);
    expect(result.key).toBe('product:p1');
    expect(result.entity).toBe('product');
    expect(result.title).toBe('Кожаный ремень');
    expect(result.productId).toBe('p1');
    expect(result.searchText).toContain('кожаный ремень');
    expect(result.searchText).toContain('ручная работа');
  });
});

describe('buildServiceResults', () => {
  it('builds a result with serviceId set for the booking action', () => {
    const [result] = buildServiceResults([SERVICE]);
    expect(result.entity).toBe('service');
    expect(result.serviceId).toBe('s1');
    expect(result.title).toBe('Стрижка');
  });
});

describe('buildPostResults', () => {
  it('builds a result linking to the real blog post URL', () => {
    const [result] = buildPostResults([POST]);
    expect(result.entity).toBe('post');
    expect(result.href).toBe('/blog/kak-uhazhivat-za-kozhey');
    expect(result.title).toBe('Как ухаживать за кожей');
  });
});

describe('buildCustomEntityResults', () => {
  const source: PublicCustomEntity = {
    entityName: 'Клиенты',
    fields: [
      { key: 'name', label: 'Имя', type: 'string', required: true },
      { key: 'phone', label: 'Телефон', type: 'string', required: false },
      { key: 'visits', label: 'Визитов', type: 'number', required: false },
    ],
    records: [
      { id: 'r1', data: { name: 'Иван Петров', phone: '+380501112233', visits: 3 } },
      { id: 'r2', data: { visits: 1 } },
    ],
  };

  it('uses the first string field as the title and joins the rest into the subtitle', () => {
    const results = buildCustomEntityResults(source, 'Клиенты');
    const first = results.find((r) => r.key === 'custom:r1')!;
    expect(first.title).toBe('Иван Петров');
    expect(first.subtitle).toBe('+380501112233');
    expect(first.searchText).toContain('иван петров');
  });

  it('falls back to "<label> #<shortId>" when no string field has a value', () => {
    const results = buildCustomEntityResults(source, 'Клиенты');
    const second = results.find((r) => r.key === 'custom:r2')!;
    expect(second.title).toBe(`Клиенты #${'r2'.slice(0, 6)}`);
    expect(second.subtitle).toBe('');
  });

  it('ignores number/boolean fields for search text, only string fields', () => {
    const numberOnlySource: PublicCustomEntity = {
      entityName: 'Заказы',
      fields: [{ key: 'total', label: 'Сумма', type: 'number', required: false }],
      records: [{ id: 'o1', data: { total: 500 } }],
    };
    const [result] = buildCustomEntityResults(numberOnlySource, 'Заказы');
    expect(result.searchText).not.toContain('500');
  });
});

describe('filterSearchResults', () => {
  const results = [
    ...buildProductResults([PRODUCT]),
    ...buildServiceResults([SERVICE]),
    ...buildPostResults([POST]),
  ];

  it('returns nothing for an empty or whitespace-only query', () => {
    expect(filterSearchResults(results, '', 10)).toEqual([]);
    expect(filterSearchResults(results, '   ', 10)).toEqual([]);
  });

  it('matches case-insensitively across all sources', () => {
    const matches = filterSearchResults(results, 'КОЖ', 10);
    expect(matches.map((m) => m.key).sort()).toEqual(['post:b1', 'product:p1'].sort());
  });

  it('respects the limit', () => {
    const matches = filterSearchResults(results, 'а', 1);
    expect(matches).toHaveLength(1);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterSearchResults(results, 'zzzzz-no-match', 10)).toEqual([]);
  });
});
