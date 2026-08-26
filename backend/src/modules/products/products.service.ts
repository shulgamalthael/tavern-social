import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Business, Product } from '@prisma/client';
import { slugify } from '@/modules/businesses/lib/slugify';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { ProductDto, PublicProductDto } from './products.types';

const MAX_SLUG_ATTEMPTS = 30;

/** Владелец-CRUD товаров одного бизнеса (см. `ProductsController` — вложен
 * под `/businesses/:businessId/products`, тот же принцип вложенности, что и
 * у `WebsitesController`: товар не существует без бизнеса). Публичное
 * чтение витрины (только активные товары, без владельца) — отдельный метод
 * `listPublic`, вызывается из `PublicSitesController`, тот же приём
 * разделения владелец/публика, что уже применён у `WebsitesService.
 * getPublic` vs `getDraft`.
 *
 * `Product` больше не хранит собственную `currency` (Currency System,
 * ROADMAP.md §8) — `toDto`/`toPublicDto` принимают её отдельным параметром,
 * полученным join'ом через `Business.currency` (см. `getBusiness`/
 * `assertOwnership` ниже), а не как поле самой строки `Product`. */
@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string, ownerId: string): Promise<ProductDto[]> {
    const business = await this.getBusiness(businessId);
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');

    const products = await this.prisma.product.findMany({
      where: { businessId },
      orderBy: { order: 'asc' },
    });
    return products.map((product) => this.toDto(product, business.currency));
  }

  async listPublic(businessId: string): Promise<PublicProductDto[]> {
    const business = await this.getBusiness(businessId);
    const products = await this.prisma.product.findMany({
      where: { businessId, isActive: true },
      orderBy: { order: 'asc' },
    });
    return products.map((product) => this.toPublicDto(product, business.currency));
  }

  async create(businessId: string, ownerId: string, dto: CreateProductDto): Promise<ProductDto> {
    const business = await this.getBusiness(businessId);
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
    const slug = await this.resolveSlug(businessId, dto.slug, dto.name);

    const count = await this.prisma.product.count({ where: { businessId } });

    const product = await this.prisma.product.create({
      data: {
        businessId,
        name: dto.name,
        slug,
        description: dto.description ?? '',
        priceCents: dto.priceCents,
        images: dto.images ?? [],
        stock: dto.stock ?? null,
        isActive: dto.isActive ?? true,
        order: count,
      },
    });
    return this.toDto(product, business.currency);
  }

  async update(
    businessId: string,
    productId: string,
    ownerId: string,
    dto: UpdateProductDto,
  ): Promise<ProductDto> {
    const business = await this.getBusiness(businessId);
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
    await this.findOwnedProduct(businessId, productId);

    const slug =
      dto.slug !== undefined
        ? await this.resolveSlug(businessId, dto.slug, dto.slug, productId)
        : undefined;

    const product = await this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
        ...(dto.images !== undefined ? { images: dto.images } : {}),
        ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toDto(product, business.currency);
  }

  async remove(businessId: string, productId: string, ownerId: string): Promise<void> {
    await this.assertOwnership(businessId, ownerId);
    await this.findOwnedProduct(businessId, productId);
    await this.prisma.product.delete({ where: { id: productId } });
  }

  /** Публичный эндпоинт загрузки фото (см. `ProductsController.uploadImage`)
   * должен убедиться, что бизнес принадлежит вызывающему, прежде чем
   * принять файл — тот же приём, что и `WebsitesService.assertOwnership`
   * для картинок блоков сайта. */
  async assertOwnership(businessId: string, ownerId: string): Promise<void> {
    const business = await this.getBusiness(businessId);
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
  }

  private async getBusiness(businessId: string): Promise<Pick<Business, 'ownerId' | 'currency'>> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true, currency: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    return business;
  }

  private async findOwnedProduct(businessId: string, productId: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.businessId !== businessId) {
      throw new NotFoundException('Товар не найден');
    }
    return product;
  }

  private async resolveSlug(
    businessId: string,
    desired: string | undefined,
    fallbackSource: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugify(desired || fallbackSource);

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const existing = await this.prisma.product.findUnique({
        where: { businessId_slug: { businessId, slug: candidate } },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return candidate;
    }

    // Практически недостижимо, но детерминированный fallback лучше 500-й.
    return `${base}-${Date.now()}`;
  }

  private toDto(product: Product, currency: string): ProductDto {
    return {
      id: product.id,
      businessId: product.businessId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      priceCents: product.priceCents,
      currency,
      images: product.images,
      stock: product.stock,
      isActive: product.isActive,
      order: product.order,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  private toPublicDto(product: Product, currency: string): PublicProductDto {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      priceCents: product.priceCents,
      currency,
      images: product.images,
      stock: product.stock,
    };
  }
}
