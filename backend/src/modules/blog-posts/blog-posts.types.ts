export interface BlogPostDto {
  id: string;
  businessId: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  isPublished: boolean;
  order: number;
  /** См. комментарий столбцов `BlogPost.seoTitle`/`seoDescription` в
   * schema.prisma — переопределение `generateMetadata` страницы чтения. */
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Публичная витрина — см. `PublicProductDto`/`PublicServiceDto`, тот же
 * приём разделения владелец/публика: без `businessId`/`order`, только
 * опубликованные посты (`isPublished: true`), сама `isPublished` тоже не
 * нужна публике — раз пост отдан, он по определению опубликован.
 * `seoTitle`/`seoDescription` присутствуют (в отличие от прочих owner-only
 * полей) — их читает `generateMetadata` страницы чтения поста, которая
 * запрашивает именно эту публичную DTO, не владельческую. */
export interface PublicBlogPostDto {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
}
