export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

/** Тот же союз, что и `entities/order`'s `PaymentStatus` — общая ось
 * "оплачено ли", ортогональная `AppointmentStatus` (см. её backend-двойник,
 * `modules/appointments/appointments.types.ts`). */
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

/** См. `entities/order`'s `PaymentUnavailableReason` — тот же смысл, тот же
 * набор значений, отдельный union (а не переиспользование через импорт из
 * `entities/order`), потому что Booking не должен зависеть от слайса
 * Commerce ради одного строкового типа. */
export type PaymentUnavailableReason = 'not_configured' | 'amount_too_low' | 'provider_error';

export const PAYMENT_UNAVAILABLE_REASON_LABELS: Record<PaymentUnavailableReason, string> = {
  not_configured:
    'Онлайн-оплата картой пока не подключена продавцом. Ваша заявка принята — с вами свяжутся для оплаты.',
  amount_too_low:
    'Сумма записи слишком мала для оплаты картой онлайн. Ваша заявка принята — с вами свяжутся для оплаты другим способом.',
  provider_error:
    'Не удалось подключить оплату картой прямо сейчас. Ваша заявка принята — с вами свяжутся для завершения оплаты.',
};

export interface Appointment {
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
  /** Только в ответе на `createAppointment`, только если Stripe настроен —
   * см. `Order.clientSecret`'s комментарий, тот же принцип. */
  clientSecret?: string;
  /** Только в ответе на `createAppointment`, только когда `clientSecret`
   * отсутствует — см. `Order.paymentUnavailableReason`'s комментарий. */
  paymentUnavailableReason?: PaymentUnavailableReason;
}

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Новая',
  confirmed: 'Подтверждена',
  completed: 'Выполнена',
  cancelled: 'Отменена',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Не оплачена',
  paid: 'Оплачена',
  refunded: 'Возврат',
};
