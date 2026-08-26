import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Business, Service } from '@prisma/client';
import { slugify } from '@/modules/businesses/lib/slugify';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';
import type { PublicServiceDto, ServiceDto } from './services.types';

const MAX_SLUG_ATTEMPTS = 30;

/** Владелец-CRUD услуг одного бизнеса — почти буквальное зеркало
 * `ProductsService` (см. её комментарии для полного обоснования паттернов:
 * вложенность под `/businesses/:businessId/services`, разделение владелец/
 * публика, генерация уникального slug в рамках бизнеса, и — как и у
 * `Product` — отсутствие собственной `currency`, см. `ProductsService`
 * про Currency System, ROADMAP.md §8). */
@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string, ownerId: string): Promise<ServiceDto[]> {
    const business = await this.getBusiness(businessId);
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');

    const services = await this.prisma.service.findMany({
      where: { businessId },
      orderBy: { order: 'asc' },
    });
    return services.map((service) => this.toDto(service, business.currency));
  }

  async listPublic(businessId: string): Promise<PublicServiceDto[]> {
    const business = await this.getBusiness(businessId);
    const services = await this.prisma.service.findMany({
      where: { businessId, isActive: true },
      orderBy: { order: 'asc' },
    });
    return services.map((service) => this.toPublicDto(service, business.currency));
  }

  async create(businessId: string, ownerId: string, dto: CreateServiceDto): Promise<ServiceDto> {
    const business = await this.getBusiness(businessId);
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
    const slug = await this.resolveSlug(businessId, dto.slug, dto.name);
    const count = await this.prisma.service.count({ where: { businessId } });

    const service = await this.prisma.service.create({
      data: {
        businessId,
        name: dto.name,
        slug,
        description: dto.description ?? '',
        durationMinutes: dto.durationMinutes,
        priceCents: dto.priceCents,
        images: dto.images ?? [],
        isActive: dto.isActive ?? true,
        order: count,
      },
    });
    return this.toDto(service, business.currency);
  }

  async update(
    businessId: string,
    serviceId: string,
    ownerId: string,
    dto: UpdateServiceDto,
  ): Promise<ServiceDto> {
    const business = await this.getBusiness(businessId);
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
    await this.findOwnedService(businessId, serviceId);

    const slug =
      dto.slug !== undefined
        ? await this.resolveSlug(businessId, dto.slug, dto.slug, serviceId)
        : undefined;

    const service = await this.prisma.service.update({
      where: { id: serviceId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.durationMinutes !== undefined ? { durationMinutes: dto.durationMinutes } : {}),
        ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
        ...(dto.images !== undefined ? { images: dto.images } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toDto(service, business.currency);
  }

  async remove(businessId: string, serviceId: string, ownerId: string): Promise<void> {
    await this.assertOwnership(businessId, ownerId);
    await this.findOwnedService(businessId, serviceId);
    await this.prisma.service.delete({ where: { id: serviceId } });
  }

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

  private async findOwnedService(businessId: string, serviceId: string): Promise<Service> {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service || service.businessId !== businessId) {
      throw new NotFoundException('Услуга не найдена');
    }
    return service;
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
      const existing = await this.prisma.service.findUnique({
        where: { businessId_slug: { businessId, slug: candidate } },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return candidate;
    }

    return `${base}-${Date.now()}`;
  }

  private toDto(service: Service, currency: string): ServiceDto {
    return {
      id: service.id,
      businessId: service.businessId,
      name: service.name,
      slug: service.slug,
      description: service.description,
      durationMinutes: service.durationMinutes,
      priceCents: service.priceCents,
      currency,
      images: service.images,
      isActive: service.isActive,
      order: service.order,
      createdAt: service.createdAt.toISOString(),
      updatedAt: service.updatedAt.toISOString(),
    };
  }

  private toPublicDto(service: Service, currency: string): PublicServiceDto {
    return {
      id: service.id,
      name: service.name,
      slug: service.slug,
      description: service.description,
      durationMinutes: service.durationMinutes,
      priceCents: service.priceCents,
      currency,
      images: service.images,
    };
  }
}
