import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import type { OrderDto } from './orders.types';
import { OrdersService } from './orders.service';

/** Владелец-only — создание заказа (анонимная витрина) живёт отдельно, в
 * `PublicSitesController` (см. её комментарий и `OrdersService.
 * createFromCart`), тот же принцип разделения владелец/публика, что и у
 * `ProductsController`/`PublicSitesController.getPublicProducts`. */
@Controller('businesses/:businessId/orders')
@UseGuards(SessionAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<OrderDto[]> {
    return this.ordersService.list(businessId, currentUser.id);
  }

  @Patch(':orderId')
  updateStatus(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderDto> {
    return this.ordersService.updateStatus(businessId, orderId, currentUser.id, dto.status);
  }

  @Post(':orderId/refund')
  refund(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
  ): Promise<OrderDto> {
    return this.ordersService.refund(businessId, orderId, currentUser.id);
  }
}
