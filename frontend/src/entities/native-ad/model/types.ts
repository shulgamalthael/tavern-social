import type { PaymentStatus } from '@/entities/order';

/** Зеркало backend's `AdBillingModel` — та же экономика, что у сайтовой
 * рекламы (`entities/advertising`), не отдельное понятие. */
export type AdBillingModel = 'cpm' | 'cpc';

export const AD_BILLING_MODEL_LABELS: Record<AdBillingModel, string> = {
  cpm: 'CPM (за 1000 показов)',
  cpc: 'CPC (за клик)',
};

export type NativeAdCampaignStatus =
  'draft' | 'pending_review' | 'active' | 'paused' | 'rejected' | 'completed';

export const NATIVE_AD_CAMPAIGN_STATUS_LABELS: Record<NativeAdCampaignStatus, string> = {
  draft: 'Черновик',
  pending_review: 'На модерации',
  active: 'Активна',
  paused: 'Приостановлена',
  rejected: 'Отклонена',
  completed: 'Завершена',
};

/** Четыре адаптивных стиля креатива (корневой план фичи, Phase 2) — в
 * отличие от сайтовой рекламы (`AdFormat`, фиксированные пиксельные
 * размеры), здесь layout всегда подстраивается под карточку ленты, разница
 * только в композиции (`NativeAdCard`). */
export type NativeAdCreativeStyle = 'minimal' | 'editorial' | 'product' | 'video';

export const NATIVE_AD_CREATIVE_STYLE_LABELS: Record<NativeAdCreativeStyle, string> = {
  minimal: 'Минимальный',
  editorial: 'Редакторский',
  product: 'Товарный',
  video: 'Видео',
};

export type NativeAdCreativeStatus = 'approved' | 'rejected';

export const NATIVE_AD_CREATIVE_STATUS_LABELS: Record<NativeAdCreativeStatus, string> = {
  approved: 'Одобрен',
  rejected: 'Отклонён',
};

export interface NativeAdCreative {
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

/** Владелец-facing кампания (см. backend `NativeAdCampaignDto`) —
 * self-service CRUD-объект, точное зеркало `AdCampaign`
 * (`entities/advertising`), но нацеленное на creator'ов, не сайты. */
export interface NativeAdCampaign {
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
  creatives: NativeAdCreative[];
  clientSecret?: string;
}

export interface CreateNativeAdCampaignInput {
  name: string;
  budgetCents: number;
  billingModel: AdBillingModel;
  bidCents: number;
  targetCategoryIds?: string[];
  targetGeography?: string[];
  adCategory?: string;
  startDate?: string;
  endDate?: string;
}

export interface AddNativeAdCreativeInput {
  style: NativeAdCreativeStyle;
  headline: string;
  bodyText?: string;
  imageUrl?: string;
  videoUrl?: string;
  ctaLabel?: string;
  targetUrl: string;
}

/** Отдаётся зрителю ленты (см. backend `NativeAdFeedItemDto`) — не полный
 * владелец-facing креатив, только то, что нужно отрисовать +
 * идентификаторы для impression/click. */
export interface NativeAdFeedItem {
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

/** Своя карточка назначения для CREATOR'а (Creator Studio → «Реклама») —
 * см. backend `CreatorNativeAdDto`'s комментарий: намеренно без денежных
 * полей, реальная атрибуция дохода — Phase 4. */
export interface CreatorNativeAd {
  assignmentId: string;
  sponsorName: string;
  style: NativeAdCreativeStyle;
  headline: string;
  imageUrl: string | null;
  status: 'active' | 'paused';
}

/** Creator Studio → «Доход» (Phase 4, см. backend `CreatorRevenueSummaryDto`'s
 * комментарий — реальная агрегация ledger'а по валютам). */
export interface CreatorRevenueByCurrency {
  currency: string;
  /** Пожизненный итог начислений, включая уже выплаченное. */
  earnedCents: number;
  /** Реально доступно для запроса выплаты (Phase 5) — см. backend
   * `CreatorRevenueByCurrencyDto`'s комментарий. */
  availableCents: number;
  impressions: number;
  clicks: number;
}

export interface CreatorRevenueSummary {
  byCurrency: CreatorRevenueByCurrency[];
}

/** Рекламодатель-facing прозрачность одной кампании (см. backend
 * `NativeAdCampaignRevenueBreakdownDto`'s комментарий). */
export interface NativeAdCampaignRevenueBreakdown {
  currency: string;
  grossCents: number;
  creatorShareCents: number;
  platformFeeCents: number;
  processingFeeCents: number;
  impressions: number;
  clicks: number;
}

/** Реальная выплата creator'у через Stripe Connect (Creator Monetization
 * Phase 5, см. backend `NativeAdPayoutDto`'s комментарий). */
export type NativeAdPayoutStatus = 'pending' | 'paid' | 'failed';

export const NATIVE_AD_PAYOUT_STATUS_LABELS: Record<NativeAdPayoutStatus, string> = {
  pending: 'В обработке',
  paid: 'Выплачено',
  failed: 'Ошибка',
};

export interface NativeAdPayout {
  id: string;
  amountCents: number;
  currency: string;
  status: NativeAdPayoutStatus;
  failureReason: string | null;
  createdAt: string;
  paidAt: string | null;
}
