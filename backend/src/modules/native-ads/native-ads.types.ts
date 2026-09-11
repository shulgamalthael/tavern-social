import type {
  AdBillingModel,
  NativeAdAssignment,
  NativeAdAssignmentStatus,
  NativeAdCampaign,
  NativeAdCampaignStatus,
  NativeAdCreative,
  NativeAdCreativeStatus,
  NativeAdCreativeStyle,
  NativeAdPayout,
  NativeAdPayoutStatus,
  PaymentStatus,
} from '@prisma/client';

export interface NativeAdCreativeDto {
  id: string;
  campaignId: string;
  style: NativeAdCreativeStyle;
  headline: string;
  bodyText: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  ctaLabel: string | null;
  targetUrl: string;
  status: NativeAdCreativeStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NativeAdCampaignDto {
  id: string;
  advertiserBusinessId: string;
  name: string;
  status: NativeAdCampaignStatus;
  rejectionReason: string | null;
  budgetCents: number;
  spentCents: number;
  currency: string;
  paymentStatus: PaymentStatus;
  billingModel: AdBillingModel;
  bidCents: number;
  impressionsServed: number;
  clicksServed: number;
  startDate: string | null;
  endDate: string | null;
  targetCategoryIds: string[];
  targetGeography: string[];
  adCategory: string | null;
  createdAt: string;
  updatedAt: string;
  creatives: NativeAdCreativeDto[];
  /** Только в ответе `submitForReview` — тот же принцип, что
   * `AdCampaignDto.clientSecret`. */
  clientSecret?: string;
}

export function toNativeAdCreativeDto(creative: NativeAdCreative): NativeAdCreativeDto {
  return {
    id: creative.id,
    campaignId: creative.campaignId,
    style: creative.style,
    headline: creative.headline,
    bodyText: creative.bodyText,
    imageUrl: creative.imageUrl,
    videoUrl: creative.videoUrl,
    ctaLabel: creative.ctaLabel,
    targetUrl: creative.targetUrl,
    status: creative.status,
    rejectionReason: creative.rejectionReason,
    createdAt: creative.createdAt.toISOString(),
    updatedAt: creative.updatedAt.toISOString(),
  };
}

export function toNativeAdCampaignDto(
  campaign: NativeAdCampaign & { creatives: NativeAdCreative[] },
  clientSecret?: string,
): NativeAdCampaignDto {
  return {
    id: campaign.id,
    advertiserBusinessId: campaign.advertiserBusinessId,
    name: campaign.name,
    status: campaign.status,
    rejectionReason: campaign.rejectionReason,
    budgetCents: campaign.budgetCents,
    spentCents: campaign.spentCents,
    currency: campaign.currency,
    paymentStatus: campaign.paymentStatus,
    billingModel: campaign.billingModel,
    bidCents: campaign.bidCents,
    impressionsServed: campaign.impressionsServed,
    clicksServed: campaign.clicksServed,
    startDate: campaign.startDate ? campaign.startDate.toISOString() : null,
    endDate: campaign.endDate ? campaign.endDate.toISOString() : null,
    targetCategoryIds: campaign.targetCategoryIds,
    targetGeography: campaign.targetGeography,
    adCategory: campaign.adCategory,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    creatives: campaign.creatives.map(toNativeAdCreativeDto),
    ...(clientSecret ? { clientSecret } : {}),
  };
}

/** Одна строка "кому назначена эта кампания" — админ-вид, см.
 * `AdminNativeAdsController.listAssignments`. */
export interface NativeAdAssignmentDto {
  id: string;
  campaignId: string;
  creatorProfileId: string;
  status: NativeAdAssignmentStatus;
  assignedAt: string;
  creatorName: string;
  creatorAvatarUrl: string | null;
}

export function toNativeAdAssignmentDto(
  assignment: NativeAdAssignment & {
    creatorProfile: { user: { name: string; avatarUrl: string | null } };
  },
): NativeAdAssignmentDto {
  return {
    id: assignment.id,
    campaignId: assignment.campaignId,
    creatorProfileId: assignment.creatorProfileId,
    status: assignment.status,
    assignedAt: assignment.assignedAt.toISOString(),
    creatorName: assignment.creatorProfile.user.name,
    creatorAvatarUrl: assignment.creatorProfile.user.avatarUrl,
  };
}

/** Своя карточка назначения для CREATOR'а (Creator Studio → "Реклама",
 * `GET native-ads/my-assignments`) — намеренно БЕЗ денежных полей
 * (`budgetCents`/`spentCents`/campaign-wide `impressionsServed`/
 * `clicksServed`): одна кампания может быть назначена НЕСКОЛЬКИМ creator'ам
 * одновременно, поэтому кампанийные счётчики — не вклад именно ЭТОГО
 * creator'а, показывать их здесь было бы честно выглядящей, но по сути
 * придуманной цифрой. Реальная атрибуция дохода по creator'у — Phase 4 (см.
 * корневой план фичи), до неё показываем только факт назначения и как
 * выглядит креатив. */
export interface CreatorNativeAdDto {
  assignmentId: string;
  sponsorName: string;
  style: NativeAdCreativeStyle;
  headline: string;
  imageUrl: string | null;
  status: NativeAdAssignmentStatus;
}

/** Композитный overview для `admin/native-ads` — тот же принцип "один
 * составной эндпоинт", что `AdminAdvertisingOverviewDto`. Без 30-дневного
 * графика по дням (в отличие от того файла) — named scope cut в §80: ядро
 * этого слайса — модерация + ручное назначение, не аналитика. */
export interface AdminNativeAdsOverviewDto {
  pendingCampaigns: NativeAdCampaignDto[];
  activeCampaigns: NativeAdCampaignDto[];
  pausedCampaigns: NativeAdCampaignDto[];
  totals: {
    impressions: number;
    clicks: number;
    ctr: number;
    /** Весь ОПЛАЧЕННЫЙ бюджет по валютам — включая ещё не потраченный, не
     * то же самое, что `realizedRevenueByCurrency` ниже. */
    revenueByCurrency: Record<string, number>;
    /** Реально реализованная выручка (сумма `NativeAdRevenueEvent`'ов) по
     * валютам, разбитая на три доли (Phase 4, AI_PLATFORM_ROADMAP.md §82) —
     * прозрачность для админа поверх ledger'а. */
    realizedRevenueByCurrency: Record<
      string,
      { creatorShareCents: number; platformFeeCents: number; processingFeeCents: number }
    >;
  };
}

/** Отдаётся в `NativeAdFeedService.getAdsForPosts` — вставляется во
 * frontend'ский `nativeAdsByAnchorPostId`, см. `entities/native-ad`. */
export interface NativeAdFeedItemDto {
  assignmentId: string;
  campaignId: string;
  creativeId: string;
  sponsorName: string;
  style: NativeAdCreativeStyle;
  headline: string;
  bodyText: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  ctaLabel: string | null;
  targetUrl: string;
}

/** Ранжированная подсказка для ручного назначения (Creator Monetization
 * Phase 3, см. `lib/creator-matching.lib.ts`'s комментарий про
 * детерминированный, не LLM, скоринг) — `GET admin/native-ads/campaigns/
 * :campaignId/recommended-creators`. Не заменяет ручное решение админа
 * (`NativeAdAssignmentsService.assign` по-прежнему принимает любой
 * `creatorProfileId`), только ранжирует и объясняет. */
export interface RecommendedCreatorDto {
  creatorProfileId: string;
  name: string;
  avatarUrl: string | null;
  primaryCategory: string | null;
  matchPercent: number;
  reasons: string[];
}

/** Creator Studio → «Доход» (Phase 4, AI_PLATFORM_ROADMAP.md §82) — реальная
 * агрегация `NativeAdRevenueEvent` по валюте, не выдуманные цифры. По
 * валютам, не единым числом — тот же принцип, что `AdminAdvertisingOverviewDto.
 * totals.revenueByCurrency` (кампании разных рекламодателей в разных
 * валютах, складывать центы разных валют бессмысленно). */
export interface CreatorRevenueByCurrencyDto {
  currency: string;
  /** Пожизненный итог начислений, включая уже выплаченное — см.
   * `NativeAdRevenueService.getMyRevenue`'s комментарий. */
  earnedCents: number;
  /** Реально доступно для НОВОГО запроса выплаты (Phase 5) — исключает
   * события, уже закрытые какой-либо выплатой (`payoutId != null`). */
  availableCents: number;
  impressions: number;
  clicks: number;
}

export interface CreatorRevenueSummaryDto {
  byCurrency: CreatorRevenueByCurrencyDto[];
}

/** Рекламодатель-facing прозрачность (корневой план фичи, требование
 * "transparent reporting to creator/advertiser/platform") — куда реально
 * уходит списанный бюджет одной кампании. Одна кампания — одна валюта
 * (снята с `Business.currency` при создании, см. `NativeAdCampaignsService.
 * create`), поэтому единое число, не разбивка по валютам, как у Creator/
 * Admin сводок. */
export interface NativeAdCampaignRevenueBreakdownDto {
  currency: string;
  grossCents: number;
  creatorShareCents: number;
  platformFeeCents: number;
  processingFeeCents: number;
  impressions: number;
  clicks: number;
}

/** Реальная выплата creator'у через Stripe Connect (Phase 5, AI_PLATFORM_
 * ROADMAP.md §83) — см. `NativeAdPayout`'s комментарий в schema.prisma. */
export interface NativeAdPayoutDto {
  id: string;
  amountCents: number;
  currency: string;
  status: NativeAdPayoutStatus;
  failureReason: string | null;
  createdAt: string;
  paidAt: string | null;
}

/** Админ-вид выплаты — то же самое + кому она принадлежит, для очереди
 * обработки (`AdminNativeAdsController`'s `payouts`). */
export interface AdminNativeAdPayoutDto extends NativeAdPayoutDto {
  creatorProfileId: string;
  creatorName: string;
}

export function toNativeAdPayoutDto(payout: NativeAdPayout): NativeAdPayoutDto {
  return {
    id: payout.id,
    amountCents: payout.amountCents,
    currency: payout.currency,
    status: payout.status,
    failureReason: payout.failureReason,
    createdAt: payout.createdAt.toISOString(),
    paidAt: payout.paidAt ? payout.paidAt.toISOString() : null,
  };
}
