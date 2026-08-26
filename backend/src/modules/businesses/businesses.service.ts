import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Business, Prisma } from '@prisma/client';
import { deleteUploadedFile } from '@/common/lib/upload';
import { DEFAULT_BUSINESS_CURRENCY } from '@/modules/currencies/currencies';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { DomainsService } from '@/modules/domains/domains.service';
import { createDefaultWebsiteDocument } from '@/modules/websites/lib/default-website-document';
import type { CreateBusinessDto } from './dto/create-business.dto';
import type { UpdateBusinessDto } from './dto/update-business.dto';
import type { BusinessDto, SocialLinkDto, TaxMode } from './businesses.types';
import { slugify } from './lib/slugify';

type BusinessWithWebsite = Business & { website: { publishedAt: Date | null } | null };

const MAX_SLUG_ATTEMPTS = 30;

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainsService: DomainsService,
  ) {}

  async list(ownerId: string): Promise<BusinessDto[]> {
    const businesses = await this.prisma.business.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      include: { website: { select: { publishedAt: true } } },
    });
    return businesses.map((business) => this.toDto(business));
  }

  async create(ownerId: string, dto: CreateBusinessDto): Promise<BusinessDto> {
    const slug = await this.resolveSlug(dto.slug, dto.name);

    // Бизнес и его сайт создаются вместе, одной транзакцией — на frontend
    // (`/business/[id]`) нет состояния «бизнес есть, а сайта ещё нет»,
    // которое пришлось бы отдельно обрабатывать в каждом месте, читающем
    // сайт (см. `WebsitesService` — там сайт уже гарантированно есть).
    const business = await this.prisma.$transaction(async (tx) => {
      const created = await tx.business.create({
        data: {
          ownerId,
          name: dto.name,
          slug,
          description: dto.description ?? '',
          category: dto.category,
          currency: dto.currency ?? DEFAULT_BUSINESS_CURRENCY,
        },
      });
      const defaultDocument = createDefaultWebsiteDocument(created.name);
      const website = await tx.website.create({
        data: {
          businessId: created.id,
          // Страницы (`defaultDocument.pages`) — отдельная таблица, не
          // часть `draft` (см. комментарий модели `Website` в schema.prisma
          // и `WebsitesService`) — здесь остаётся только тема/настройки.
          draft: {
            theme: defaultDocument.theme,
            settings: defaultDocument.settings,
          } as unknown as Prisma.InputJsonValue,
          // `id` НЕ переносим из шаблона (`page.id: 'home'`, см.
          // `createDefaultWebsiteDocument`) — тот id был уникален только в
          // рамках одного JSON-документа; `WebsitePage.id` теперь глобальный
          // первичный ключ таблицы, тот же буквальный 'home' у ВТОРОГО
          // созданного бизнеса столкнулся бы с первым. Опускаем поле —
          // Prisma сама сгенерирует настоящий уникальный uuid (`@default
          // (uuid())` в schema.prisma).
          pages: {
            create: defaultDocument.pages.map((page, index) => ({
              slug: page.slug,
              title: page.title,
              content: page.blocks as unknown as Prisma.InputJsonValue,
              order: index,
            })),
          },
        },
      });
      await this.domainsService.createSystemDomain(tx, website.id, slug);
      return created;
    });

    return this.toDto({ ...business, website: { publishedAt: null } });
  }

  async getOne(id: string, ownerId: string): Promise<BusinessDto> {
    const business = await this.findOwned(id, ownerId);
    return this.toDto(business);
  }

  async update(id: string, ownerId: string, dto: UpdateBusinessDto): Promise<BusinessDto> {
    await this.findOwned(id, ownerId);

    const slug =
      dto.slug !== undefined ? await this.resolveSlug(dto.slug, dto.slug, id) : undefined;

    const updated = await this.prisma.business.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.socialLinks !== undefined
          ? { socialLinks: dto.socialLinks as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.seoTitle !== undefined ? { seoTitle: dto.seoTitle } : {}),
        ...(dto.seoDescription !== undefined ? { seoDescription: dto.seoDescription } : {}),
        ...(dto.capabilities !== undefined ? { capabilities: dto.capabilities } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.taxRateBps !== undefined ? { taxRateBps: dto.taxRateBps } : {}),
        ...(dto.taxMode !== undefined ? { taxMode: dto.taxMode as TaxMode } : {}),
      },
      include: { website: { select: { id: true, publishedAt: true } } },
    });

    if (slug !== undefined && updated.website) {
      await this.domainsService.handleSlugChanged(this.prisma, updated.website.id, slug);
    }

    return this.toDto(updated);
  }

  /** Каскад в схеме сам чистит `Website` и все зависимые строки — здесь
   * остаётся только то, что каскад не видит: файлы лого/favicon на диске
   * (тот же приём, что `GroupsService.remove`/`UsersService.setAvatar`).
   * Картинки, вставленные в сами блоки сайта (JSON `draft`/`published`), НЕ
   * чистятся — это известное упрощение MVP (см. корневой план фичи, раздел
   * про billing/будущее): нет отдельного реестра файлов блоков, как у
   * `PostImage` для постов, garbage collection — задача на будущее. */
  async remove(id: string, ownerId: string): Promise<void> {
    const business = await this.findOwned(id, ownerId);
    await this.prisma.business.delete({ where: { id } });
    deleteUploadedFile(business.logoUrl);
    deleteUploadedFile(business.faviconUrl);
  }

  /** Копия черновика сайта (не опубликованной версии — дубликат всегда
   * стартует как черновик, даже если оригинал уже опубликован: это новый,
   * ещё нигде не показанный бизнес). Лого/favicon не перезаливаются на
   * диск — новая запись просто указывает на тот же файл (тот же компромисс,
   * что и у `remove` выше: нет реестра ссылок на файлы). */
  async duplicate(id: string, ownerId: string): Promise<BusinessDto> {
    const original = await this.prisma.business.findUnique({
      where: { id },
      include: { website: { include: { pages: { orderBy: { order: 'asc' } } } } },
    });
    if (!original || original.ownerId !== ownerId) {
      throw new NotFoundException('Бизнес не найден');
    }

    const name = `${original.name} (копия)`;
    const slug = await this.resolveSlug(undefined, name);

    const business = await this.prisma.$transaction(async (tx) => {
      const created = await tx.business.create({
        data: {
          ownerId,
          name,
          slug,
          description: original.description,
          category: original.category,
          logoUrl: original.logoUrl,
          faviconUrl: original.faviconUrl,
          email: original.email,
          phone: original.phone,
          address: original.address,
          socialLinks: original.socialLinks as Prisma.InputJsonValue,
          seoTitle: original.seoTitle,
          seoDescription: original.seoDescription,
          capabilities: original.capabilities,
          currency: original.currency,
          taxRateBps: original.taxRateBps,
          taxMode: original.taxMode,
        },
      });
      const defaultDocument = createDefaultWebsiteDocument(name);
      const originalPages = original.website?.pages ?? [];
      const website = await tx.website.create({
        data: {
          businessId: created.id,
          draft:
            (original.website?.draft as Prisma.InputJsonValue) ??
            ({
              theme: defaultDocument.theme,
              settings: defaultDocument.settings,
            } as unknown as Prisma.InputJsonValue),
          // Копируем строки `WebsitePage` оригинала (не `id` — тот же
          // принцип, что и в `migrate-pages-to-table.ts`: `id` — глобальный
          // первичный ключ таблицы, копия не может делить его с оригиналом).
          // Оригинал без единой страницы (гипотетически) — сеем страницы
          // шаблона по умолчанию, как и у только что созданного бизнеса.
          pages: {
            create:
              originalPages.length > 0
                ? originalPages.map((page) => ({
                    slug: page.slug,
                    title: page.title,
                    type: page.type,
                    systemKey: page.systemKey,
                    content: page.content as Prisma.InputJsonValue,
                    seoTitle: page.seoTitle,
                    seoDescription: page.seoDescription,
                    isHidden: page.isHidden,
                    order: page.order,
                  }))
                : defaultDocument.pages.map((page, index) => ({
                    slug: page.slug,
                    title: page.title,
                    content: page.blocks as unknown as Prisma.InputJsonValue,
                    order: index,
                  })),
          },
        },
      });
      await this.domainsService.createSystemDomain(tx, website.id, slug);
      return created;
    });

    return this.toDto({ ...business, website: { publishedAt: null } });
  }

  async setLogo(id: string, ownerId: string, url: string): Promise<BusinessDto> {
    const business = await this.findOwned(id, ownerId);
    deleteUploadedFile(business.logoUrl);
    const updated = await this.prisma.business.update({
      where: { id },
      data: { logoUrl: url },
      include: { website: { select: { publishedAt: true } } },
    });
    return this.toDto(updated);
  }

  async setFavicon(id: string, ownerId: string, url: string): Promise<BusinessDto> {
    const business = await this.findOwned(id, ownerId);
    deleteUploadedFile(business.faviconUrl);
    const updated = await this.prisma.business.update({
      where: { id },
      data: { faviconUrl: url },
      include: { website: { select: { publishedAt: true } } },
    });
    return this.toDto(updated);
  }

  /** 404, не 403, когда бизнес существует, но принадлежит другому — тот же
   * принцип, что и везде в проекте (см. `GroupsService`): чужой ресурс
   * должен выглядеть так, будто его вообще нет, а не «есть, но не тебе». */
  private async findOwned(id: string, ownerId: string): Promise<BusinessWithWebsite> {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: { website: { select: { publishedAt: true } } },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) {
      throw new ForbiddenException('Это не ваш бизнес');
    }
    return business;
  }

  private async resolveSlug(
    desired: string | undefined,
    fallbackSource: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugify(desired || fallbackSource);

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const existing = await this.prisma.business.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return candidate;
    }

    // Практически недостижимо (30 занятых вариантов подряд одного базового
    // slug), но детерминированный fallback лучше, чем упасть с 500.
    return `${base}-${Date.now()}`;
  }

  private toDto(business: BusinessWithWebsite): BusinessDto {
    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      description: business.description,
      category: business.category,
      logoUrl: business.logoUrl,
      faviconUrl: business.faviconUrl,
      email: business.email,
      phone: business.phone,
      address: business.address,
      socialLinks: (business.socialLinks as unknown as SocialLinkDto[] | null) ?? [],
      seoTitle: business.seoTitle,
      seoDescription: business.seoDescription,
      capabilities: business.capabilities,
      currency: business.currency,
      taxRateBps: business.taxRateBps,
      taxMode: business.taxMode,
      status: business.website?.publishedAt ? 'published' : 'draft',
      createdAt: business.createdAt.toISOString(),
      updatedAt: business.updatedAt.toISOString(),
    };
  }
}
