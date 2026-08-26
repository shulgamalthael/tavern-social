/**
 * Pricing Engine (Phase 17, см. `PRICING_ARCHITECTURE.md`) — единственное
 * место, где считается денежная арифметика заказа: subtotal → discount →
 * tax → total. Чистые функции без БД/NestJS DI (как `currencies.ts`) —
 * вызывается один раз из `OrdersService.createFromCart` (единственный путь
 * создания заказа) и один раз из превью-эндпоинта купона
 * (`PublicSitesController.previewCoupon`), так что показанная в корзине
 * скидка и реально списанная сумма физически не могут разойтись — это одна
 * и та же функция, а не два похожих расчёта.
 *
 * Порядок: скидка применяется к subtotal, налог — к сумме ПОСЛЕ скидки
 * (стандартная конвенция реальных платформ — Shopify, Stripe Tax; скидка
 * должна уменьшать налогооблагаемую сумму, а не просто уменьшать
 * отображаемый итог после того, как налог уже посчитан с полной цены).
 * Только целые минимальные единицы валюты — никакого `Float` (см.
 * `PRICING_ARCHITECTURE.md` §1/§3).
 */

export interface PricingLineItem {
  priceCents: number;
  quantity: number;
}

export interface PricingDiscount {
  type: 'percentage' | 'fixed';
  /** percentage: 1-100. fixed: минимальные единицы валюты бизнеса. */
  value: number;
}

export type TaxMode = 'none' | 'inclusive' | 'exclusive';

export interface PricingInput {
  items: PricingLineItem[];
  taxRateBps: number;
  taxMode: TaxMode;
  discount?: PricingDiscount;
}

export interface PricingResult {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

export function calculateOrderPricing(input: PricingInput): PricingResult {
  const subtotalCents = input.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);

  let discountCents = 0;
  if (input.discount) {
    discountCents =
      input.discount.type === 'percentage'
        ? Math.round((subtotalCents * input.discount.value) / 100)
        : input.discount.value;
    // Скидка не может увести заказ в минус, независимо от того, насколько
    // большой fixed-скидка была задана относительно текущей корзины.
    discountCents = Math.min(discountCents, subtotalCents);
  }

  const taxableCents = subtotalCents - discountCents;

  let taxCents = 0;
  if (input.taxMode === 'exclusive') {
    taxCents = Math.round((taxableCents * input.taxRateBps) / 10_000);
  } else if (input.taxMode === 'inclusive') {
    // Налог уже внутри taxableCents — считаем только для отображения в
    // разбивке заказа, сам totalCents от этого не меняется.
    taxCents = taxableCents - Math.round((taxableCents * 10_000) / (10_000 + input.taxRateBps));
  }

  const totalCents = input.taxMode === 'exclusive' ? taxableCents + taxCents : taxableCents;

  return { subtotalCents, discountCents, taxCents, totalCents };
}

/** Причины отказа, которые может вернуть `checkDiscountEligibility` —
 * "код не найден" сюда не входит, потому что это проверяется отдельно, ДО
 * вызова этой функции (нужен сам `Discount`, чтобы её вызвать). */
export type DiscountEligibilityReason =
  'inactive' | 'not_started' | 'expired' | 'usage_limit_reached' | 'min_order_not_met';

/** Полный набор причин отказа купона, каким его видит публичный превью-
 * эндпоинт (`discounts.types.ts`, `CouponPreviewResult`) — включает
 * `'not_found'`, единственную причину, для которой `Discount` вообще не
 * существует. */
export type DiscountRejectionReason = DiscountEligibilityReason | 'not_found';

/** Разделяемая проверка условий скидки (даты/лимит/минимальная сумма) —
 * вызывается и превью-эндпоинтом купона, и реальным созданием заказа
 * (`OrdersService`), на одних и тех же данных `Discount` из БД, так что
 * ответ "применимо" не может разойтись между предпросмотром и списанием
 * (расхождение в самом списании по гонке usageLimit — отдельная атомарная
 * проверка `updateMany`, см. `PRICING_ARCHITECTURE.md` §5/§7).
 */
export function checkDiscountEligibility(
  discount: {
    isActive: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
    usageLimit: number | null;
    usageCount: number;
    minOrderAmountCents: number | null;
  },
  subtotalCents: number,
  now: Date = new Date(),
): DiscountEligibilityReason | null {
  if (!discount.isActive) return 'inactive';
  if (discount.startsAt && now < discount.startsAt) return 'not_started';
  if (discount.endsAt && now > discount.endsAt) return 'expired';
  if (discount.usageLimit !== null && discount.usageCount >= discount.usageLimit) {
    return 'usage_limit_reached';
  }
  if (discount.minOrderAmountCents !== null && subtotalCents < discount.minOrderAmountCents) {
    return 'min_order_not_met';
  }
  return null;
}
