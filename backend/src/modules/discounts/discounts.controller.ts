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
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import type { DiscountDto } from './discounts.types';
import { DiscountsService } from './discounts.service';

/** Вложено под `/businesses/:businessId/discounts` — скидка не существует
 * без бизнеса, тот же принцип, что у `ProductsController`. Публичное
 * применение купона на витрине живёт отдельно, в `PublicSitesController`
 * (`POST /sites/:businessId/coupons/preview`) — этот контроллер целиком
 * owner-only. */
@Controller('businesses/:businessId/discounts')
@UseGuards(SessionAuthGuard)
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Get()
  list(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<DiscountDto[]> {
    return this.discountsService.list(businessId, currentUser.id);
  }

  @Post()
  create(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateDiscountDto,
  ): Promise<DiscountDto> {
    return this.discountsService.create(businessId, currentUser.id, dto);
  }

  @Patch(':discountId')
  update(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('discountId') discountId: string,
    @Body() dto: UpdateDiscountDto,
  ): Promise<DiscountDto> {
    return this.discountsService.update(businessId, discountId, currentUser.id, dto);
  }

  @Delete(':discountId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('discountId') discountId: string,
  ): Promise<void> {
    return this.discountsService.remove(businessId, discountId, currentUser.id);
  }
}
