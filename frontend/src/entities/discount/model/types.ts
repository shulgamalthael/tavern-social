export type DiscountType = 'percentage' | 'fixed';

/** Pricing Engine (Phase 17 — см. `PRICING_ARCHITECTURE.md` §2): одна
 * сущность вместо предложенного спецификацией разделения Discount/Coupon —
 * `code: null` значит "автоматическая скидка", применяется к каждому
 * подходящему заказу без ввода чего-либо; ненулевой `code` — требует этот
 * код на чекауте (см. `CouponField` в `CartWidget`). */
export interface Discount {
  id: string;
  businessId: string;
  name: string;
  code: string | null;
  type: DiscountType;
  /** percentage: 1-100. fixed: минимальные единицы валюты бизнеса — см.
   * `formatMoney`/`toMinorUnits` для показа/ввода. */
  value: number;
  minOrderAmountCents: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  percentage: 'Процент',
  fixed: 'Фиксированная сумма',
};

export type DiscountRejectionReason =
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'usage_limit_reached'
  | 'min_order_not_met';

export const DISCOUNT_REJECTION_LABELS: Record<DiscountRejectionReason, string> = {
  not_found: 'Промокод не найден',
  inactive: 'Промокод отключён',
  not_started: 'Промокод ещё не действует',
  expired: 'Срок действия промокода истёк',
  usage_limit_reached: 'Промокод больше недоступен',
  min_order_not_met: 'Сумма заказа меньше минимальной для этого промокода',
};

export type CouponPreviewResult =
  | { valid: true; name: string; type: DiscountType; value: number; discountCents: number }
  | { valid: false; reason: DiscountRejectionReason };
