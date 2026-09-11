/** Чисто вычисляемое разделение выручки одного события (Creator
 * Monetization Phase 4, см. AI_PLATFORM_ROADMAP.md §82) — вынесено отдельно
 * ради юнит-тестов без Prisma, тот же приём, что `creator-matching.lib.ts`/
 * `native-ad-feed.lib.ts`. */

export interface RevenueSplitSettings {
  creatorRevenueShareBps: number;
  platformFeeBps: number;
  paymentProcessingFeeBps: number;
}

export interface RevenueSplit {
  creatorShareCents: number;
  platformFeeCents: number;
  processingFeeCents: number;
}

/**
 * Делит `grossCents` (реальная сумма, списанная с бюджета рекламодателя ЗА
 * ОДНО событие — дельта, не накопленный итог кампании, см.
 * `NativeAdCampaignsService.recordImpression/recordClick`'s комментарий) на
 * три части по текущим `NativeAdRevenueSettings`. `processingFeeCents` —
 * ОСТАТОК (`grossCents` минус два других), не независимо вычисленная доля:
 * если три Bps в сумме дают не ровно 10000 (не должно происходить, см.
 * `UpdateNativeAdRevenueSettingsDto`'s валидацию), остаток честно поглощает
 * разницу, а не теряет или дублирует центы — тот же принцип, что уже
 * применён к округлению в `AdCampaignsService.applySpend`.
 */
export function splitRevenue(grossCents: number, settings: RevenueSplitSettings): RevenueSplit {
  const creatorShareCents = Math.floor((grossCents * settings.creatorRevenueShareBps) / 10000);
  const platformFeeCents = Math.floor((grossCents * settings.platformFeeBps) / 10000);
  const processingFeeCents = grossCents - creatorShareCents - platformFeeCents;
  return { creatorShareCents, platformFeeCents, processingFeeCents };
}
