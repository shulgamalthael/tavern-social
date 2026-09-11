import type { PublicBlogPost } from '@/entities/blog-post';
import type { CustomEntityField, PublicCustomEntity } from '@/entities/custom-entity';
import type { PublicProduct } from '@/entities/product';
import type { PublicService } from '@/entities/service';
import { formatMoney } from '@/shared/lib/format-money';

/**
 * Один нормализованный результат поиска — общая форма для всех четырёх
 * возможных источников (`product`/`service`/`post`/`custom`), которую
 * рендерер `entitysearch` (`blocks/navigation/index.tsx`) показывает
 * одинаково, независимо от того, откуда результат пришёл. Билдеры ниже
 * (`buildProductResults`/…) — чистые функции без React/сети, юнит-
 * тестируются напрямую (`entity-search.test.ts`), тот же приём, что и
 * `countdown.ts` (см. её комментарий про `vitest.config.mts`).
 */
export interface EntitySearchResult {
  /** Стабильный React-key — `${entity}:${id}`, уникален и внутри одного
   * источника, и при нескольких источниках одного `entity` (два разных
   * `custom`-источника не могут дать одинаковый `id`, id — UUID записи). */
  key: string;
  entity: 'product' | 'service' | 'post' | 'custom';
  title: string;
  subtitle: string;
  /** Уже в нижнем регистре — то, против чего матчится запрос
   * (`filterSearchResults`), включает `title`/`subtitle`, чтобы искать не
   * только по заголовку. */
  searchText: string;
  /** Только для `entity: 'product'` — id для `AddToCartButton`. */
  productId?: string;
  /** Только для `entity: 'service'` — id для `BookAppointmentButton`. */
  serviceId?: string;
  /** Только для `entity: 'post'` — реальный URL страницы чтения
   * (`/blog/{slug}`, см. `blocks/blog/index.tsx`, тот же путь). */
  href?: string;
}

export function buildProductResults(products: PublicProduct[]): EntitySearchResult[] {
  return products.map((product) => {
    const subtitle = formatMoney(product.priceCents, product.currency);
    return {
      key: `product:${product.id}`,
      entity: 'product',
      title: product.name,
      subtitle,
      searchText: `${product.name} ${product.description}`.toLowerCase(),
      productId: product.id,
    };
  });
}

export function buildServiceResults(services: PublicService[]): EntitySearchResult[] {
  return services.map((service) => {
    const subtitle = formatMoney(service.priceCents, service.currency);
    return {
      key: `service:${service.id}`,
      entity: 'service',
      title: service.name,
      subtitle,
      searchText: `${service.name} ${service.description}`.toLowerCase(),
      serviceId: service.id,
    };
  });
}

export function buildPostResults(posts: PublicBlogPost[]): EntitySearchResult[] {
  return posts.map((post) => ({
    key: `post:${post.id}`,
    entity: 'post',
    title: post.title,
    subtitle: post.excerpt,
    searchText: `${post.title} ${post.excerpt}`.toLowerCase(),
    href: `/blog/${post.slug}`,
  }));
}

/** Заголовок записи — значение первого текстового поля (в порядке, как их
 * завёл владелец); если текстовых полей нет вообще — предсказуемый
 * фолбэк по имени сущности + короткому id, а не пустая строка (см. `label`
 * — подпись ИСТОЧНИКА поиска из `EntitySearchSource`, не самой сущности,
 * поэтому передаётся отдельно, не берётся из `source.entityName`). Строка
 * поиска — конкатенация ВСЕХ текстовых полей, не только заголовочного,
 * чтобы находить записи по любому текстовому значению, не только по
 * первому полю. */
export function buildCustomEntityResults(
  source: PublicCustomEntity,
  label: string,
): EntitySearchResult[] {
  const stringFields = source.fields.filter(
    (field): field is CustomEntityField & { type: 'string' } => field.type === 'string',
  );

  return source.records.map((record) => {
    const stringValues = stringFields
      .map((field) => record.data[field.key])
      .filter((value): value is string => typeof value === 'string' && value.length > 0);

    const title = stringValues[0] ?? `${label} #${record.id.slice(0, 6)}`;
    const subtitle = stringValues.slice(1).join(' · ');

    return {
      key: `custom:${record.id}`,
      entity: 'custom',
      title,
      subtitle,
      searchText: (stringValues.length > 0 ? stringValues.join(' ') : title).toLowerCase(),
    };
  });
}

/** Пустой запрос — пустой список результатов (виджет не должен вываливать
 * ВСЁ содержимое сайта до того, как посетитель хоть что-то напечатал), не
 * "показать всё" и не ошибка. Совпадение — простой регистронезависимый
 * substring по `searchText`, без фаззи-логики: каталоги/сущности бизнеса
 * малы (тот же масштаб, что у `productgrid`/`servicegrid`/`bloggrid`, см.
 * ROADMAP.md §8 Phase 14 — измерено, не предположено), полнотекстовый
 * поиск/ранжирование были бы избыточны для этой партии. */
export function filterSearchResults(
  results: EntitySearchResult[],
  query: string,
  limit: number,
): EntitySearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return [];

  const matches = results.filter((result) => result.searchText.includes(normalized));
  return matches.slice(0, limit);
}
