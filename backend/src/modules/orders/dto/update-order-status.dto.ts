import { IsIn } from 'class-validator';
import type { OrderStatus } from '../orders.types';

export const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES, { message: 'Недопустимый статус заказа' })
  status!: OrderStatus;
}
