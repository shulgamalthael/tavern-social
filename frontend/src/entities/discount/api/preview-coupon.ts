'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import type { CouponPreviewResult } from '../model/types';

/**
 * По-настоящему анонимный запрос (см. `PublicSitesController.previewCoupon`,
 * тот же принцип, что и `getPublicProducts`) — вызывается из `CouponField` в
 * `CartWidget` ДО оформления заказа, чтобы показать "Применено ✓ / Промокод
 * не найден" сразу. Это ПРЕДПРОСМОТР — реальное применение купона происходит
 * заново, независимо, внутри `createOrder` (см. `PRICING_ARCHITECTURE.md` §5).
 */
export async function previewCoupon(
  businessId: string,
  code: string,
  subtotalCents: number,
): Promise<CouponPreviewResult> {
  return backendFetch<CouponPreviewResult>(`/sites/${businessId}/coupons/preview`, {
    method: 'POST',
    body: { code, subtotalCents },
  });
}
