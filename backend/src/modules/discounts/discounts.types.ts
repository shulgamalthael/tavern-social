import type { DiscountRejectionReason } from '@/modules/pricing/pricing';

export type { DiscountRejectionReason };

export type DiscountType = 'percentage' | 'fixed';

/** Owner-CRUD представление (Dashboard "Скидки") — включает `code`/`usageCount`,
 * которые публичному покупателю видеть незачем (см. `PublicDiscountPreviewDto`
 * ниже — отдельный, гораздо более узкий ответ для превью купона). */
export interface DiscountDto {
  id: string;
  businessId: string;
  name: string;
  code: string | null;
  type: DiscountType;
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

/** Ответ превью-эндпоинта купона на публичной витрине (`PublicSitesController.
 * previewCoupon`) — см. `PRICING_ARCHITECTURE.md` §5: это ПРЕДПРОСМОТР, не
 * резервирование `usageCount` и не источник истины для реального списания
 * (то происходит заново, независимо, в `OrdersService.createFromCart`). */
export type CouponPreviewResult =
  | { valid: true; name: string; type: DiscountType; value: number; discountCents: number }
  | { valid: false; reason: DiscountRejectionReason };
