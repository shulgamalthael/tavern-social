import type { PlanTier } from './billing.types';

/** Сколько рекламных слотов (`adslot`-блоков в Builder'е) доступно бизнесу на
 * каждом тарифе — единственный источник истины для этого числа, см.
 * `AdvertisingInventoryService.getInventory`. Редактируется свободно оператором
 * (согласовано с владельцем продукта как черновик, а не финальные цифры). */
export const AD_SLOT_ENTITLEMENTS: Record<PlanTier, number> = {
  free: 0,
  starter: 1,
  business: 3,
  scale: 6,
  enterprise: 10,
};

/** `tier` — `null`, когда у бизнеса ещё нет строки `BusinessSubscription`
 * (тариф ни разу не выбирался, см. `BillingService.getStatus`) — это самый
 * строгий случай, эквивалентный `free`: 0 слотов, а не ошибка/дефолт наугад. */
export function getAdSlotLimit(tier: PlanTier | null): number {
  if (tier === null) {
    return AD_SLOT_ENTITLEMENTS.free;
  }
  return AD_SLOT_ENTITLEMENTS[tier];
}
