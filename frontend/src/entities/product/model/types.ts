/** Первая реальная сущность капабилити Commerce (см. ROADMAP.md §2.2/§8
 * Phase 5) — сознательно узкий v1: без вариантов/SKU, категорий, скидок и
 * отзывов (см. комментарий модели `Product` в backend schema.prisma для
 * полного обоснования). */
export interface Product {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  description: string;
  /** Целое число минимальных единиц ВАЛЮТЫ БИЗНЕСА — см. `formatMoney`
   * (`shared/lib/format-money.ts`) и комментарий `Product.priceCents` на
   * backend про Currency System (ROADMAP.md §8). */
  priceCents: number;
  /** Всегда равна `Business.currency` — `Product` не хранит свою валюту
   * отдельно (см. её backend-комментарий), это поле — просто то же
   * значение, подставленное сервером в ответ. */
  currency: string;
  images: string[];
  stock: number | null;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** Публичная витрина — то, что реально видит посетитель сайта (см.
 * `PublicProductDto` на backend): без `businessId`/`order` (внутренние
 * детали владельца), только активные товары. */
export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  currency: string;
  images: string[];
  stock: number | null;
}
