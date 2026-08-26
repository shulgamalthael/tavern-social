import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import type { AnalyticsSummaryDto } from './analytics.types';
import { AnalyticsService } from './analytics.service';

/** Владелец-only чтение — записи сюда попадают только как побочный эффект
 * реальных действий на сайте (см. `AnalyticsService.record`), не через
 * этот контроллер: здесь нет `POST`. */
@Controller('businesses/:businessId/analytics')
@UseGuards(SessionAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  summary(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<AnalyticsSummaryDto> {
    return this.analyticsService.summary(businessId, currentUser.id);
  }
}
