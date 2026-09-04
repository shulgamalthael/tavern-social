import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, WebsitePage as WebsitePageRow } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { UpdateWebsiteDocumentDto } from './dto/update-website-document.dto';
import { sanitizeRichBlocks } from './lib/sanitize-rich-blocks';
import type {
  WebsiteDocument,
  WebsiteDraftDto,
  WebsitePage,
  WebsitePublicDto,
  WebsiteTheme,
} from './websites.types';

/** Форма, в которой теперь реально лежат `Website.draft`/`Website.
 * published` в БД — БЕЗ `pages` (см. комментарий модели `Website` в
 * schema.prisma: страницы — отдельная таблица `WebsitePage`). Полный
 * `WebsiteDocument` (с массивом страниц) существует только как ответ API,
 * собранный на лету в `assembleDocument` ниже. */
interface StoredWebsiteDocument {
  theme: WebsiteTheme;
  settings: Record<string, unknown>;
}

@Injectable()
export class WebsitesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Черновик — только владельцу, используется и билдером, и его Preview
   * (см. корневой план: «Preview должен использовать тот же renderer, что и
   * публичная страница» — рендерер один и тот же на frontend, здесь просто
   * два разных источника документа: draft для Preview/builder, published
   * для публичной страницы, см. `getPublic` ниже). */
  async getDraft(businessId: string, ownerId: string): Promise<WebsiteDraftDto> {
    const website = await this.findOwned(businessId, ownerId);
    const pages = await this.prisma.websitePage.findMany({
      where: { websiteId: website.id },
      orderBy: { order: 'asc' },
    });

    return {
      businessId,
      document: this.assembleDocument(website.draft as unknown as StoredWebsiteDocument, pages),
      updatedAt: website.updatedAt.toISOString(),
    };
  }

  /** Вызывается автосохранением билдера (debounce — на frontend, см.
   * `entities/website/model/use-autosave.ts`). Страницы (`dto.pages`)
   * синхронизируются с таблицей `WebsitePage` — новые (id ещё нет в БД)
   * создаются, существующие обновляются, отсутствующие в присланном списке
   * удаляются (билдер всегда шлёт ПОЛНЫЙ список страниц документа, не diff —
   * тот же принцип, что и раньше был у самого документа целиком, просто
   * теперь применяется к таблице, а не к одному JSON-полю). `theme`/
   * `settings` по-прежнему одним полем поверх `Website.draft` — они меняются
   * не так часто, как страницы, и не нуждаются в собственной таблице. */
  async saveDraft(
    businessId: string,
    ownerId: string,
    dto: UpdateWebsiteDocumentDto,
  ): Promise<WebsiteDraftDto> {
    const website = await this.findOwned(businessId, ownerId);
    const incomingPages = this.validatePages(dto.pages).map((page) => ({
      ...page,
      blocks: sanitizeRichBlocks(page.blocks),
    }));

    await this.prisma.$transaction(async (tx) => {
      const incomingIds = incomingPages.map((page) => page.id);

      await tx.websitePage.deleteMany({
        where: {
          websiteId: website.id,
          id: { notIn: incomingIds.length > 0 ? incomingIds : ['__none__'] },
        },
      });

      for (const [index, page] of incomingPages.entries()) {
        const data = {
          slug: page.slug,
          title: page.title,
          content: page.blocks as unknown as Prisma.InputJsonValue,
          order: index,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
          ogImage: page.ogImage,
        };
        await tx.websitePage.upsert({
          where: { id: page.id },
          update: data,
          create: { id: page.id, websiteId: website.id, ...data },
        });
      }

      await tx.website.update({
        where: { id: website.id },
        data: {
          draft: { theme: dto.theme, settings: dto.settings } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return this.getDraft(businessId, ownerId);
  }

  /** Публикация — снимок черновика становится опубликованной версией:
   * текущие строки `WebsitePage` (черновик каждой страницы) + текущие
   * `theme`/`settings` из `draft` пересобираются в один `WebsiteDocument` и
   * целиком кладутся в `published` (см. комментарий модели `Website` —
   * «снимок всего сайта одним полем», без риска рассинхронизировать тему с
   * контентом при частичной публикации). Версии публикаций/история изменений
   * не хранятся — известное упрощение MVP (см. корневой план, раздел про
   * будущее: «version history», «rollback» — архитектура это не блокирует). */
  async publish(businessId: string, ownerId: string): Promise<WebsiteDraftDto> {
    const website = await this.findOwned(businessId, ownerId);
    const pages = await this.prisma.websitePage.findMany({
      where: { websiteId: website.id },
      orderBy: { order: 'asc' },
    });
    const document = this.assembleDocument(
      website.draft as unknown as StoredWebsiteDocument,
      pages,
    );

    const updated = await this.prisma.website.update({
      where: { businessId },
      data: {
        published: document as unknown as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
    });

    return { businessId, document, updatedAt: updated.updatedAt.toISOString() };
  }

  /** Без проверки владения — публичная страница `/business/[id]` открыта
   * любому вошедшему в Таверну пользователю (полноценно анонимный публичный
   * доступ — задача на будущее, см. корневой план, раздел «domains»; сейчас
   * маршрут всё равно живёт под `(protected)`, см. AGENTS.md про auth).
   * `published` уже хранит полный `WebsiteDocument` (с `pages` внутри) — его
   * пересобирает `publish()` выше, здесь просто отдаём как есть, без
   * обращения к таблице `WebsitePage` (та отражает ЧЕРНОВИК, не то, что
   * должны видеть посетители). */
  async getPublic(businessId: string): Promise<WebsitePublicDto> {
    const website = await this.prisma.website.findUnique({
      where: { businessId },
      include: { business: true },
    });
    if (!website) throw new NotFoundException('Сайт не найден');

    return {
      business: {
        id: website.business.id,
        name: website.business.name,
        slug: website.business.slug,
        logoUrl: website.business.logoUrl,
        category: website.business.category,
        capabilities: website.business.capabilities,
        seoTitle: website.business.seoTitle,
        seoDescription: website.business.seoDescription,
        currency: website.business.currency,
      },
      document: website.published as unknown as WebsiteDocument | null,
      isPublished: website.publishedAt !== null,
      publishedAt: website.publishedAt?.toISOString() ?? null,
    };
  }

  /** Только проверка владения, без чтения содержимого — для эндпоинтов,
   * которым нужен рубеж доступа, но не сам документ (см. `WebsitesController.
   * uploadAsset`). */
  async assertOwnership(businessId: string, ownerId: string): Promise<void> {
    await this.findOwned(businessId, ownerId);
  }

  private async findOwned(businessId: string, ownerId: string) {
    const website = await this.prisma.website.findUnique({
      where: { businessId },
      include: { business: { select: { ownerId: true } } },
    });
    if (!website) throw new NotFoundException('Сайт не найден');
    if (website.business.ownerId !== ownerId) {
      throw new ForbiddenException('Это не ваш бизнес');
    }
    return website;
  }

  /** Собирает полный `WebsiteDocument` (то, что реально ожидает frontend —
   * см. `entities/website/model/types.ts`) из хранимых отдельно `theme`/
   * `settings` и строк `WebsitePage`, отсортированных по `order`. Первая по
   * порядку страница — домашняя (см. комментарий модели `WebsitePage`,
   * почему это позиция, а не отдельный флаг). */
  private assembleDocument(
    stored: StoredWebsiteDocument,
    pages: WebsitePageRow[],
  ): WebsiteDocument {
    return {
      pages: pages.map((page): WebsitePage => ({
        id: page.id,
        slug: page.slug,
        title: page.title,
        blocks: (page.content ?? []) as unknown as WebsitePage['blocks'],
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        ogImage: page.ogImage,
      })),
      theme: stored.theme,
      settings: stored.settings,
    };
  }

  /** `UpdateWebsiteDocumentDto.pages` намеренно валидируется только на
   * верхнем уровне (`unknown[]`, см. её комментарий) — форма конкретного
   * блока не должна требовать правки backend. Но КАЖДАЯ страница теперь
   * становится отдельной строкой БД по `id`, поэтому здесь — минимальная
   * проверка формы, необходимая именно для этого (id/slug/title — строки),
   * а не полная схема документа. */
  private validatePages(pages: unknown[]): WebsitePage[] {
    return pages.map((page, index) => {
      if (
        typeof page !== 'object' ||
        page === null ||
        typeof (page as Record<string, unknown>).id !== 'string' ||
        typeof (page as Record<string, unknown>).slug !== 'string' ||
        typeof (page as Record<string, unknown>).title !== 'string'
      ) {
        throw new BadRequestException(`pages[${index}] должен иметь строковые id/slug/title`);
      }
      const candidate = page as {
        id: string;
        slug: string;
        title: string;
        blocks?: unknown;
        seoTitle?: unknown;
        seoDescription?: unknown;
        ogImage?: unknown;
      };
      return {
        id: candidate.id,
        slug: candidate.slug,
        title: candidate.title,
        blocks: Array.isArray(candidate.blocks) ? (candidate.blocks as WebsitePage['blocks']) : [],
        seoTitle: typeof candidate.seoTitle === 'string' ? candidate.seoTitle : null,
        seoDescription:
          typeof candidate.seoDescription === 'string' ? candidate.seoDescription : null,
        ogImage: typeof candidate.ogImage === 'string' ? candidate.ogImage : null,
      };
    });
  }
}
