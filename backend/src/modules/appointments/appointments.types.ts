import type { PaymentUnavailableReason } from '@/modules/payments/payments.types';

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

/** Тот же союз, что и `Order.paymentStatus` (см. `modules/orders/
 * orders.types.ts`) — общая ось "оплачено ли" у обеих капабилити, не
 * дублированный отдельный enum ради формальной независимости модулей. */
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

export interface AppointmentDto {
  id: string;
  businessId: string;
  serviceId: string | null;
  serviceName: string;
  priceCents: number;
  durationMinutes: number;
  currency: string;
  status: AppointmentStatus;
  startsAt: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerNote: string;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  /** Только в ответе на `createFromRequest`, только если Stripe настроен —
   * см. `OrderDto.clientSecret`'s комментарий, тот же принцип один в один. */
  clientSecret?: string;
  /** Только в ответе на `createFromRequest`, только когда `clientSecret`
   * отсутствует — см. `OrderDto.paymentUnavailableReason`'s комментарий. */
  paymentUnavailableReason?: PaymentUnavailableReason;
}
