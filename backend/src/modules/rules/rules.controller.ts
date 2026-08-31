import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import type { CustomerLoyaltyAccountDto, RuleDto } from './rules.types';
import { RulesService } from './rules.service';

/** Вложено под `/businesses/:businessId/rules` — правило не существует без
 * бизнеса, тот же принцип, что у `DiscountsController`. Целиком owner-only:
 * срабатывание правил (`RulesService.evaluate`) вызывается напрямую из
 * `PublicSitesController` (см. её комментарий), не через этот контроллер —
 * у "сработать" нет HTTP-запроса пользователя, это побочный эффект другого
 * реального события. */
@Controller('businesses/:businessId/rules')
@UseGuards(SessionAuthGuard)
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  list(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<RuleDto[]> {
    return this.rulesService.list(businessId, currentUser.id);
  }

  @Post()
  create(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateRuleDto,
  ): Promise<RuleDto> {
    return this.rulesService.create(businessId, currentUser.id, dto);
  }

  @Patch(':ruleId')
  update(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateRuleDto,
  ): Promise<RuleDto> {
    return this.rulesService.update(businessId, ruleId, currentUser.id, dto);
  }

  @Delete(':ruleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('ruleId') ruleId: string,
  ): Promise<void> {
    return this.rulesService.remove(businessId, ruleId, currentUser.id);
  }

  /** Накопленные баллы/тиры покупателей (`add_loyalty_points`/
   * `set_membership_tier`, см. `RulesService.runActions`) — отдельный путь
   * от `:ruleId`, не конфликтует (тот берётся только `Patch`/`Delete`). */
  @Get('loyalty-accounts')
  listLoyaltyAccounts(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<CustomerLoyaltyAccountDto[]> {
    return this.rulesService.listLoyaltyAccounts(businessId, currentUser.id);
  }
}
