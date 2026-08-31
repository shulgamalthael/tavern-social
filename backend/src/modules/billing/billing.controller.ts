import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { BillingService } from './billing.service';
import { SelectPlanDto } from './dto/select-plan.dto';
import type { BillingStatusDto, PlanEventDto, SelectPlanResultDto } from './billing.types';

/** Вложено под `/businesses/:businessId/billing` — тот же принцип, что у
 * `DiscountsController`: тариф не существует без бизнеса. Нет `GET plans`
 * эндпоинта — статичный каталог тиров это маркетинговый копирайт, живущий
 * TS-константой на frontend (`entities/subscription/config/plan-catalog.ts`),
 * лишний round-trip за 5 неизменными строками не нужен. */
@Controller('businesses/:businessId/billing')
@UseGuards(SessionAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('status')
  getStatus(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<BillingStatusDto> {
    return this.billingService.getStatus(businessId, currentUser.id);
  }

  /** Единая точка "сменить тариф в любой момент" (Free↔Starter↔Business↔
   * Scale, в любую сторону) — см. `BillingService.selectPlan`'s комментарий
   * про три возможных пути (мгновенное переключение / отмена / чекаут). */
  @Post('select-plan')
  selectPlan(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Body() dto: SelectPlanDto,
  ): Promise<SelectPlanResultDto> {
    return this.billingService.selectPlan(businessId, currentUser.id, dto.tier);
  }

  @Post('enterprise-inquiry')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordEnterpriseInquiry(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<void> {
    return this.billingService.recordEnterpriseInquiry(businessId, currentUser.id);
  }

  @Get('history')
  listHistory(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<PlanEventDto[]> {
    return this.billingService.listHistory(businessId, currentUser.id);
  }
}
