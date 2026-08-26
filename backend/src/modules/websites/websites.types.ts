/**
 * Форма JSON-документа сайта — то, что лежит в `Website.draft`/`Website.
 * published` (см. схему). Backend её почти не разбирает (см.
 * `UpdateWebsiteDocumentDto` — только верхнеуровневая форма), вся логика
 * блоков живёт на frontend (`entities/website/model/types.ts`, единственный
 * источник правды по фактической форме `props` каждого типа блока) — здесь
 * достаточно версии-двойника ровно настолько подробной, чтобы:
 *  1) собрать дефолтный пустой документ для только что созданного бизнеса
 *     (см. `lib/default-website-document.ts`);
 *  2) типизировать то, что возвращают `WebsitesService`-методы.
 * Специально `Record<string, unknown>` для `props`/`style`/`settings` —
 * business-логика билдера должна уметь принять новый тип блока с новыми
 * полями `props`, не трогая backend вообще (AI-ready декларативная модель,
 * см. корневой план фичи).
 */
export interface WebsiteBlock {
  id: string;
  type: string;
  props: Record<string, unknown>;
  style?: Record<string, unknown>;
  hidden?: Record<string, unknown>;
  children?: WebsiteBlock[];
}

export interface WebsitePage {
  id: string;
  slug: string;
  title: string;
  blocks: WebsiteBlock[];
  /** См. комментарий столбцов `WebsitePage.seoTitle`/`seoDescription`/
   * `ogImage` в schema.prisma — переопределение метаданных именно этой
   * страницы, `null` значит «используй дефолт сайта» (см. `generateMetadata`
   * в `frontend/src/app/site/[businessId]/[[...slug]]/page.tsx`). */
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
}

export interface WebsiteTheme {
  colors: Record<string, string>;
  fonts: Record<string, string>;
  radius: string;
  buttonStyle: string;
  containerWidth: string;
  sectionSpacing: string;
  cardBorder: string;
  cardShadow: string;
}

export interface WebsiteDocument {
  pages: WebsitePage[];
  theme: WebsiteTheme;
  settings: Record<string, unknown>;
}

export interface WebsiteDraftDto {
  businessId: string;
  document: WebsiteDocument;
  updatedAt: string;
}

export interface WebsitePublicDto {
  business: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    category: string;
    /** Публикуется анонимно намеренно — не секрет, просто «продаёт ли этот
     * сайт что-то онлайн», нужно frontend'у, чтобы решить, показывать ли
     * глобальную корзину (см. `entities/cart`, `CartWidget`) на странице. */
    capabilities: string[];
    /** Фолбэк САМОГО НИЗКОГО приоритета для `generateMetadata` (страница →
     * `WebsiteDocument.settings` → это поле → просто `business.name`, см.
     * ROADMAP.md §3.11/§8 Phase 10) — публикуется анонимно по той же
     * причине, что и остальные поля `business` здесь: страница нужна
     * анонимному посетителю, значит и метаданные для неё нужны анонимно. */
    seoTitle: string | null;
    seoDescription: string | null;
    /** Валюта бизнеса (Currency System, ROADMAP.md §8) — публикуется
     * анонимно по той же причине, что и `capabilities`: `productgrid`/
     * `servicegrid`-блоки и `CartWidget` уже получают её отдельно на каждом
     * товаре/услуге (`PublicProductDto.currency`/`PublicServiceDto.
     * currency`), но публикация здесь тоже нужна — например, пустой каталог
     * без единого товара всё равно должен уметь показать «валюта: USD»
     * где-нибудь в оформлении сайта, не только там, где уже есть хотя бы
     * один товар. */
    currency: string;
  };
  document: WebsiteDocument | null;
  isPublished: boolean;
  publishedAt: string | null;
}
