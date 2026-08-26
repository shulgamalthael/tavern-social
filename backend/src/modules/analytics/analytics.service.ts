import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { AnalyticsEventType, AnalyticsSummaryDto } from './analytics.types';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Событийная статистика бизнеса — см. комментарий модели `AnalyticsEvent`
 * в schema.prisma. `record()` вызывается из реальных мест действия
 * (`PublicSitesController.getPublicSite`, `OrdersService.createFromCart`,
 * `AppointmentsService.createFromRequest`, `FormSubmissionsService.
 * createFromRequest`), `summary()` — единственный владелец-only читающий
 * метод, потребитель которого сегодня — одна строка в `OverviewSection` на
 * frontend, не полноценный дашборд (см. §6 корневого плана: тот
 * откладывается до появления реального объёма событий). */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Намеренно не бросает исключение наружу — статистика не должна
   * провалить настоящее действие (создание заказа/записи/заявки, или даже
   * просто показ страницы), тот же приём, что и у `MediaAssetsService.
   * record`. */
  async record(
    businessId: string,
    type: AnalyticsEventType,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: { businessId, type, metadata: metadata as Prisma.InputJsonValue | undefined },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Не удалось записать событие ${type} для бизнеса ${businessId}: ${message}`);
    }
  }

  async summary(businessId: string, ownerId: string): Promise<AnalyticsSummaryDto> {
    await this.assertOwnership(businessId, ownerId);

    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);
    const [last7DaysRows, allTimeRows] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ['type'],
        where: { businessId, createdAt: { gte: sevenDaysAgo } },
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['type'],
        where: { businessId },
        _count: { _all: true },
      }),
    ]);

    return {
      last7Days: Object.fromEntries(last7DaysRows.map((row) => [row.type, row._count._all])),
      allTime: Object.fromEntries(allTimeRows.map((row) => [row.type, row._count._all])),
    };
  }

  private async assertOwnership(businessId: string, ownerId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
  }
}
