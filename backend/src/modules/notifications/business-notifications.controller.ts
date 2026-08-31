import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { BusinessNotificationDto } from './notifications.types';
import { NotificationsService } from './notifications.service';

/**
 * Business Logic Engine v1's notifications экран (AI_PLATFORM_ROADMAP.md
 * §15.4) — отдельный контроллер, не метод в `NotificationsController`,
 * потому что этот вложен под `/businesses/:businessId/...` (тот же URL-
 * префикс, что у `RulesController`/`CustomWidgetsController`), а
 * `NotificationsController` — под плоским `/notifications` для социальной
 * ленты пользователя. Оба используют один и тот же `NotificationsService`
 * (тот же приём, что `OrdersController`/`StripeWebhookController` в модуле
 * `orders` — два контроллера, один сервис, когда у роутов разные префиксы).
 */
@Controller('businesses/:businessId/notifications')
@UseGuards(SessionAuthGuard)
export class BusinessNotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<BusinessNotificationDto[]> {
    await this.assertOwnership(businessId, currentUser.id);
    return this.notificationsService.listForBusiness(businessId, currentUser.id);
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
