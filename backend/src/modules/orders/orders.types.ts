import type { PaymentUnavailableReason } from '@/modules/payments/payments.types';

export type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

/** Отдельная от `OrderStatus` ось — см. комментарий модели `Order` в
 * schema.prisma (`status` про выполнение продавцом, `paymentStatus` про
 * деньги). */
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

export interface OrderItemDto {
  id: string;
  productId: string | null;
  name: string;
  priceCents: number;
  quantity: number;
}

export interface OrderDto {
  id: string;
  businessId: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerNote: string;
  /** Разбивка цены (Pricing Engine, Phase 17 — см. `PRICING_ARCHITECTURE.md`
   * §6): сумма товаров ДО скидки/налога. */
  subtotalCents: number;
  /** Сколько вычтено скидкой — 0, если скидка не применялась. */
  discountCents: number;
  /** Снэпшот `Discount.name` на момент заказа — `null`, если скидки не было. */
  discountName: string | null;
  /** Код, который ввёл покупатель, если применял — снэпшот, не FK. */
  couponCode: string | null;
  /** Сколько налога включено/добавлено — 0 при `Business.taxMode: 'none'`. */
  taxCents: number;
  totalCents: number;
  currency: string;
  paymentStatus: PaymentStatus;
  items: OrderItemDto[];
  createdAt: string;
  updatedAt: string;
  /** Только в ответе на `createFromCart`, только если Stripe настроен (см.
   * `PaymentProvider.isConfigured`) — frontend передаёт его в Stripe Elements
   * (`<Elements options={{clientSecret}}>`), чтобы собрать форму оплаты для
   * ИМЕННО этого заказа. `undefined` при повторном чтении заказа (`list`) —
   * секрет одноразовый, смысла возвращать его повторно нет. */
  clientSecret?: string;
  /** Только в ответе на `createFromCart`, только когда `clientSecret`
   * отсутствует — почему онлайн-оплата недоступна именно для этого заказа
   * (см. `PaymentUnavailableReason` в `modules/payments/payments.types.ts`),
   * чтобы frontend показал причину вместо молчаливого пропуска шага оплаты. */
  paymentUnavailableReason?: PaymentUnavailableReason;
}
