import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { MediaAsset } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { MediaAssetDto } from './media-assets.types';

/** Библиотека медиа бизнеса — см. комментарий модели `MediaAsset` в
 * schema.prisma. `record()` вызывается из контроллеров, уже проверивших
 * владение перед этим (`WebsitesController.uploadAsset`, `Products
 * Controller.uploadImage`, `ServicesController.uploadImage`,
 * `BlogPostsController.uploadImage`) — сам этот сервис владением не
 * занимается для записи, только для чтения (`list`). */
@Injectable()
export class MediaAssetsService {
  private readonly logger = new Logger(MediaAssetsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Намеренно не бросает исключение наружу — попадание строки в
   * Библиотеку является бонусом к уже состоявшейся загрузке файла, а не её
   * условием: если запись в `media_assets` не удалась, посетитель всё
   * равно должен получить свой `{ url }` и продолжить работу (тот же
   * принцип, что у `OrdersService.createFromCart`, где создание
   * `PaymentIntent` деградирует так же тихо). */
  async record(businessId: string, url: string, mimeType: string): Promise<void> {
    try {
      await this.prisma.mediaAsset.create({ data: { businessId, url, mimeType } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Не удалось сохранить ${url} в медиатеку бизнеса ${businessId}: ${message}`);
    }
  }

  async list(businessId: string, ownerId: string): Promise<MediaAssetDto[]> {
    await this.assertOwnership(businessId, ownerId);
    const rows = await this.prisma.mediaAsset.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  private async assertOwnership(businessId: string, ownerId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
  }

  private toDto(row: MediaAsset): MediaAssetDto {
    return {
      id: row.id,
      businessId: row.businessId,
      url: row.url,
      mimeType: row.mimeType,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
