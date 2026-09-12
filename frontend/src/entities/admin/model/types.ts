import type {
  AdBillingModel,
  AdCampaignStatus,
  AdCreativeStatus,
  AdFormat,
  AdPlacement,
} from '@/entities/advertising';
import type { BusinessCategory } from '@/entities/business';
import type { CreatorStatus } from '@/entities/creator';
import type { GroupType } from '@/entities/group';
import type {
  AdBillingModel as NativeAdBillingModel,
  NativeAdCampaignStatus,
  NativeAdCreativeStatus,
  NativeAdCreativeStyle,
  NativeAdPayoutStatus,
} from '@/entities/native-ad';
import type { PaymentStatus } from '@/entities/order';
import type { PlanTier } from '@/entities/subscription';
import type { UserRole } from '@/entities/user';

export type AdminUserRoleFilter = 'all' | UserRole;
export type AdminUserStatusFilter = 'all' | 'active' | 'banned';
export type AdminPostTypeFilter = 'all' | 'original' | 'repost';
export type AdminPostLocationFilter = 'all' | 'wall' | 'group';

export interface AdminUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  /** Защищённый уровень поверх role='admin' — нельзя забанить/удалить/
   * понизить в роли никому, кроме другого супер-админа (см.
   * `widgets/admin/ui/AdminUsersPanel.tsx`, `setSuperAdmin`). */
  isSuperAdmin: boolean;
  isBanned: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
  createdAt: string;
  postsCount: number;
}

export interface AdminUsersPage {
  items: AdminUser[];
  nextCursor: string | null;
}

export interface AdminPost {
  id: string;
  /** У репоста — текст оригинала (см. `AdminService.listPosts` на backend) —
   * своего текста у карточки-обёртки нет. */
  text: string;
  isRepost: boolean;
  /** URL картинок в контенте, в порядке появления, для репоста — уже из
   * оригинала (тем же принципом, что и `text`). `text` рендерится в
   * `AdminPostsPanel` как есть — этот список нужен только для
   * `ImageLightbox` при клике по инлайн-картинке, тем же приёмом, что и
   * `Post.images`/`PostCard` на основном сайте. */
  images: string[];
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorAvatarUrl: string | null;
  groupId: string | null;
  groupName: string | null;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
}

export interface AdminPostsPage {
  items: AdminPost[];
  nextCursor: string | null;
}

export interface AdminGroup {
  id: string;
  name: string;
  initials: string;
  description: string;
  type: GroupType;
  avatarUrl: string | null;
  coverUrl: string | null;
  membersCount: number;
  postsCount: number;
  createdAt: string;
}

export interface AdminGroupsPage {
  items: AdminGroup[];
  nextCursor: string | null;
}

/** У Community нет своей картинки (см. `cover` — текстовая подпись, а не
 * файл, см. `AdminService` на backend), поэтому в списке — только инициалы,
 * как у пользователя без аватара. */
export interface AdminCommunity {
  id: string;
  name: string;
  initials: string;
  about: string;
  cover: string;
  membersCount: number;
  postsCount: number;
  createdAt: string;
}

export interface AdminCommunitiesPage {
  items: AdminCommunity[];
  nextCursor: string | null;
}

export interface AdminDailyPoint {
  date: string;
  count: number;
}

export interface AdminTopAuthor {
  userId: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  postsCount: number;
}

export interface AdminTopCircle {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  membersCount: number;
}

export interface AdminStats {
  totals: {
    users: number;
    bannedUsers: number;
    posts: number;
    comments: number;
    groups: number;
    communities: number;
  };
  usersByDay: AdminDailyPoint[];
  postsByDay: AdminDailyPoint[];
  topAuthors: AdminTopAuthor[];
  topGroups: AdminTopCircle[];
  topCommunities: AdminTopCircle[];
}

/** AI Capacity & Cost Manager — зеркалит `AiInfrastructureOverviewDto`
 * (`backend/src/modules/ai/capacity/ai-capacity.types.ts`) один в один, без
 * промежуточного маппинга: backend уже отдаёт данные в форме, готовой для
 * рендера (проценты уже посчитаны, суммы уже в микро-USD), лишний слой
 * трансформации здесь был бы просто дублированием. */
export type AiCapacityStatus = 'normal' | 'warning' | 'critical' | 'emergency';

export interface AiCapacitySnapshot {
  rpm: { used: number; safetyLimit: number; officialLimit: number; usedPercent: number };
  rpd: { used: number; safetyLimit: number; officialLimit: number; usedPercent: number };
  tpm: { used: number };
  status: AiCapacityStatus;
}

export interface AiCostSummary {
  todayCostMicros: number;
  monthCostMicros: number;
  todayRequestCount: number;
  monthRequestCount: number;
}

export interface AiForecast {
  sufficientData: boolean;
  averageDailyGrowthPercent: number;
  projectedRequestsIn30Days: number;
  daysUntilCapacityInsufficient: number | null;
}

export interface AiBudgetStatus {
  scope: 'global' | 'business';
  businessId: string | null;
  monthlyLimitCents: number;
  spentMicros: number;
  remainingMicros: number;
  spentPercent: number;
}

export interface AiUsageByOperation {
  operation: string;
  requestCount: number;
  totalTokens: number;
  costMicros: number;
}

export interface AiUsageByBusiness {
  businessId: string;
  requestCount: number;
  totalTokens: number;
  costMicros: number;
}

export interface AiAlert {
  id: string;
  type: string;
  severity: 'warning' | 'critical' | 'emergency';
  message: string;
  createdAt: string;
}

export interface AiAnomaly {
  id: string;
  type: string;
  description: string;
  detectedAt: string;
}

export interface AiRecommendation {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

export interface AiInfrastructureOverview {
  capacity: AiCapacitySnapshot;
  cost: AiCostSummary;
  forecast: AiForecast;
  budgets: AiBudgetStatus[];
  topOperations: AiUsageByOperation[];
  topBusinesses: AiUsageByBusiness[];
  recentAlerts: AiAlert[];
  recentAnomalies: AiAnomaly[];
  recommendations: AiRecommendation[];
  tierInfo: {
    providerTierDetectionAvailable: false;
    currentLimits: { rpm: number; rpd: number };
  };
}

// --- Advertising (см. backend `AdminAdvertisingController`, AI_PLATFORM_
// ROADMAP.md §68) — та же независимая admin-DTO копия, что и `AdminUser`
// выше: переиспользует только МЕЛКИЕ leaf-типы соседних entities (`PlanTier`/
// `BusinessCategory`/`PaymentStatus`/`AdPlacement`/`AdFormat`/`AdCampaignStatus`),
// но сама форма композитного DTO — своя, не импорт целого `AdCampaign` из
// `entities/advertising` (тому не нужна форма "кампания + все креативы для
// модерации", это чисто admin-view).

export interface AdminAdCreative {
  id: string;
  campaignId: string;
  format: AdFormat;
  headline: string;
  description: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  ctaLabel: string | null;
  targetUrl: string;
  status: AdCreativeStatus;
  rejectionReason: string | null;
}

export interface AdminAdCampaign {
  id: string;
  advertiserBusinessId: string;
  name: string;
  status: AdCampaignStatus;
  rejectionReason: string | null;
  budgetCents: number;
  spentCents: number;
  currency: string;
  paymentStatus: PaymentStatus;
  billingModel: AdBillingModel;
  bidCents: number;
  impressionsServed: number;
  clicksServed: number;
  targetCategories: BusinessCategory[];
  targetPlacements: AdPlacement[];
  /** ISO 3166-1 alpha-2 — см. backend `AdCampaign.targetCountries`'s
   * комментарий. Пусто — любая страна. */
  targetCountries: string[];
  /** Декларативный флаг «18+» — см. backend `AdCampaign.isAdultContent`'s
   * комментарий, только сигнал администратору при модерации. */
  isAdultContent: boolean;
  createdAt: string;
  creatives: AdminAdCreative[];
}

export interface AdminAdBusinessSlots {
  businessId: string;
  businessName: string;
  tier: PlanTier | null;
  slotLimit: number;
  slotsOccupied: number;
  slotsAvailable: number;
}

export interface AdminAdvertiserBan {
  businessId: string;
  businessName: string;
  reason: string | null;
  bannedAt: string;
}

export interface AdminAdvertisingOverview {
  pendingCampaigns: AdminAdCampaign[];
  /** Единственное место, откуда админ может дойти до per-creative
   * модерации отдельного креатива уже одобренной кампании. */
  activeCampaigns: AdminAdCampaign[];
  /** `status: 'paused'` — сегодня только автоматически, при исчерпании
   * бюджета. Read-only здесь (без approve/reject) — "продлить бюджет"
   * доплачивает сам рекламодатель (self-service, `AdCampaignTopUpModal`),
   * не админ, см. backend `AdCampaignsService.requestTopUp`. */
  pausedCampaigns: AdminAdCampaign[];
  businesses: AdminAdBusinessSlots[];
  bannedAdvertisers: AdminAdvertiserBan[];
  /** Показы/клики по дням за последние 30 дней, платформа целиком — дни
   * без событий всё равно присутствуют с нулями (см. backend `bucketByDay`).
   * Разбивка ПО КАЖДОЙ кампании — `campaignPerformance` ниже. */
  dailyStats: { date: string; impressions: number; clicks: number }[];
  /** См. backend `AdminCampaignPerformanceDto`'s комментарий — все кампании,
   * кроме `draft`, отсортированы по `spentCents` по убыванию. Деньги
   * нативно в своей валюте каждой строки, между строками не суммируются
   * (та же причина, что у `revenueByCurrency` ниже). */
  campaignPerformance: AdminCampaignPerformance[];
  totals: {
    impressions: number;
    clicks: number;
    ctr: number;
    /** Ключ — код валюты, значение — сумма `budgetCents` оплаченных
     * кампаний В ЭТОЙ валюте (см. backend `AdminAdvertisingOverviewDto`'s
     * комментарий про то, почему это не единое число). */
    revenueByCurrency: Record<string, number>;
  };
}

export interface AdminCampaignPerformance {
  campaignId: string;
  campaignName: string;
  businessId: string;
  businessName: string;
  status: AdCampaignStatus;
  impressionsServed: number;
  clicksServed: number;
  ctr: number;
  spentCents: number;
  budgetCents: number;
  currency: string;
}

// --- Creators (Creator Monetization Phase 1, см. backend
// `AdminCreatorsController`, AI_PLATFORM_ROADMAP.md §79) — тот же принцип,
// что у Advertising выше: своя урезанная admin-view форма, переиспользует
// только `CreatorStatus` из `entities/creator`.

export interface AdminCreatorListItem {
  id: string;
  status: CreatorStatus;
  rejectionReason: string | null;
  suspendedReason: string | null;
  user: { id: string; name: string; avatarUrl: string | null };
  primaryCategory: string | null;
  createdAt: string;
}

/** Плоская строка админ-CRUD над `CreatorCategory` (§84, изначально
 * отложенный nice-to-have §79) — см. backend `AdminCreatorCategoryDto`'s
 * комментарий про `depth`/зачем не переиспользуется рекурсивный
 * `CreatorCategoryNode` из `entities/creator`. */
export interface AdminCreatorCategory {
  id: string;
  slug: string;
  label: string;
  icon: string | null;
  parentId: string | null;
  order: number;
  depth: number;
}

export interface CreateCreatorCategoryInput {
  slug: string;
  label: string;
  icon?: string;
  parentId?: string;
  order?: number;
}

export interface UpdateCreatorCategoryInput {
  slug?: string;
  label?: string;
  icon?: string;
  /** Пустая строка — явно перенести на верхний уровень, см. backend
   * `UpdateCreatorCategoryDto`'s комментарий. */
  parentId?: string;
  order?: number;
}

// --- Native Advertising (Creator Monetization Phase 2, см. backend
// `AdminNativeAdsController`, AI_PLATFORM_ROADMAP.md §80) — тот же принцип,
// что у Advertising/Creators выше: своя урезанная admin-view форма.

export interface AdminNativeAdCreative {
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
}

export interface AdminNativeAdCampaign {
  id: string;
  advertiserBusinessId: string;
  name: string;
  status: NativeAdCampaignStatus;
  rejectionReason: string | null;
  budgetCents: number;
  spentCents: number;
  currency: string;
  paymentStatus: PaymentStatus;
  billingModel: NativeAdBillingModel;
  bidCents: number;
  impressionsServed: number;
  clicksServed: number;
  targetCategoryIds: string[];
  targetGeography: string[];
  adCategory: string | null;
  createdAt: string;
  creatives: AdminNativeAdCreative[];
}

export interface AdminNativeAdsOverview {
  pendingCampaigns: AdminNativeAdCampaign[];
  activeCampaigns: AdminNativeAdCampaign[];
  pausedCampaigns: AdminNativeAdCampaign[];
  totals: {
    impressions: number;
    clicks: number;
    ctr: number;
    revenueByCurrency: Record<string, number>;
    /** Реально реализованная выручка (сумма ledger'а), разбитая на три доли
     * — см. backend `AdminNativeAdsOverviewDto.totals.realizedRevenueByCurrency`'s
     * комментарий. */
    realizedRevenueByCurrency: Record<
      string,
      { creatorShareCents: number; platformFeeCents: number; processingFeeCents: number }
    >;
  };
}

/** Компактная строка выбора creator'а при ручном назначении — см. backend
 * `EligibleCreatorDto`'s комментарий. */
export interface EligibleCreator {
  creatorProfileId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  primaryCategory: string | null;
}

export interface NativeAdAssignment {
  id: string;
  campaignId: string;
  creatorProfileId: string;
  status: 'active' | 'paused';
  assignedAt: string;
  creatorName: string;
  creatorAvatarUrl: string | null;
}

/** Ранжированная подсказка при ручном назначении (Creator Monetization
 * Phase 3, см. backend `RecommendedCreatorDto`'s комментарий —
 * детерминированный скоринг, не вызов LLM, admin по-прежнему решает сам). */
export interface RecommendedCreator {
  creatorProfileId: string;
  name: string;
  avatarUrl: string | null;
  primaryCategory: string | null;
  matchPercent: number;
  reasons: string[];
}

/** Админ-конфигурируемые проценты распределения выручки (Creator
 * Monetization Phase 4, см. backend `NativeAdRevenueSettingsService`'s
 * комментарий — базисные пункты, не хардкод, сумма трёх долей всегда
 * 10000). */
export interface NativeAdRevenueSettings {
  id: string;
  creatorRevenueShareBps: number;
  platformFeeBps: number;
  paymentProcessingFeeBps: number;
  minimumPayoutCents: number;
  updatedAt: string;
}

export interface UpdateNativeAdRevenueSettingsInput {
  creatorRevenueShareBps: number;
  platformFeeBps: number;
  paymentProcessingFeeBps: number;
  minimumPayoutCents: number;
}

/** Очередь выплат, ожидающих реального перевода через Stripe Connect
 * (Creator Monetization Phase 5, см. backend `AdminNativeAdPayoutDto`'s
 * комментарий). */
export interface AdminNativeAdPayout {
  id: string;
  amountCents: number;
  currency: string;
  status: NativeAdPayoutStatus;
  failureReason: string | null;
  createdAt: string;
  paidAt: string | null;
  creatorProfileId: string;
  creatorName: string;
}
