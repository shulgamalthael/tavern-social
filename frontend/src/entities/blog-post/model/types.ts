/** Первая сущность капабилити Content (см. ROADMAP.md §2.2/§8 Phase 7) —
 * сознательно узкий v1: без `Author`/`Category`/`Tag`/`Comment` (см.
 * комментарий модели `BlogPost` в backend schema.prisma). Названа `BlogPost`,
 * не `Post` — в проекте уже есть `entities/post` (лента/стена социальной
 * части приложения), совпадение имён создало бы путаницу импортов. */
export interface BlogPost {
  id: string;
  businessId: string;
  title: string;
  slug: string;
  excerpt: string;
  /** Обычный текст с пустой строкой между абзацами, не HTML — см.
   * комментарий модели `BlogPost` на backend о том, почему здесь нет
   * полноценного WYSIWYG-редактора в этом инкременте. */
  content: string;
  coverImage: string | null;
  isPublished: boolean;
  order: number;
  /** Переопределение `generateMetadata` страницы чтения — см. комментарий
   * столбцов `BlogPost.seoTitle`/`seoDescription` в backend schema.prisma.
   * `null` значит «используй `title`/`excerpt`». */
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicBlogPost {
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
