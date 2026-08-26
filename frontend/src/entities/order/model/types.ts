export type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

/** Отдельная от `OrderStatus` ось — та про выполнение продавцом, эта про
 * деньги (см. комментарий модели `Order` в backend schema.prisma). `unpaid`
 * — не обязательно «ничего не оплачено»: это ещё и статус ЛЮБОГО заказа,
 * оформленного до подключения Stripe у бизнеса (см. `PublicSitesController.
 * createOrder`/`OrdersService.createFromCart` — без Stripe заказ остаётся
 * честной заявкой). */
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

/** Почему `createOrder` не вернул `clientSecret` для этого конкретного
 * заказа (см. `CreateOrderResult` в `api/create-order.ts`) — раньше
 * отсутствие `clientSecret` было неотличимо от «этому бизнесу оплата не
 * нужна», даже когда Stripe настроен, но упал по конкретной причине.
 * `CartWidget` показывает разный текст подсказки на каждое значение (см.
 * `PAYMENT_UNAVAILABLE_REASON_LABELS`). */
export type PaymentUnavailableReason = 'not_configured' | 'amount_too_low' | 'provider_error';

export const PAYMENT_UNAVAILABLE_REASON_LABELS: Record<PaymentUnavailableReason, string> = {
  not_configured:
    'Онлайн-оплата картой пока не подключена продавцом. Ваш заказ принят — с вами свяжутся для оплаты.',
  amount_too_low:
    'Сумма заказа слишком мала для оплаты картой онлайн. Ваш заказ принят — с вами свяжутся для оплаты другим способом.',
  provider_error:
    'Не удалось подключить оплату картой прямо сейчас. Ваш заказ принят — с вами свяжутся для завершения оплаты.',
};

export interface OrderItem {
  id: string;
  productId: string | null;
  name: string;
  priceCents: number;
  quantity: number;
}

export interface Order {
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
  /** Снэпшот названия скидки на момент заказа — `null`, если скидки не было. */
  discountName: string | null;
  /** Промокод, который ввёл покупатель, если применял. */
  couponCode: string | null;
  /** Сколько налога включено/добавлено — 0, если у бизнеса `taxMode: 'none'`. */
  taxCents: number;
  totalCents: number;
  currency: string;
  paymentStatus: PaymentStatus;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Новый',
  confirmed: 'Подтверждён',
  completed: 'Выполнен',
  cancelled: 'Отменён',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Не оплачен',
  paid: 'Оплачен',
  refunded: 'Возврат',
};
