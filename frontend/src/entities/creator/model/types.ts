/** Зеркало backend's `CreatorStatus`/`CreatorAdFrequency`
 * (`backend/prisma/schema.prisma`) — та же "две независимые копии одного
 * контракта", что и у других enum-зеркал в проекте. */
export type CreatorStatus =
  'verification_pending' | 'verified' | 'active' | 'rejected' | 'suspended';
export type CreatorAdFrequency = 'low' | 'balanced' | 'high';

/** Зеркало backend's `CreatorStripeConnectStatus` (Creator Monetization
 * Phase 5) — статус подключения реальных выплат через Stripe Connect,
 * независим от `CreatorStatus` (тот про верификацию личности/eligibility,
 * этот — про готовность ПОЛУЧАТЬ деньги). */
export type CreatorStripeConnectStatus = 'not_connected' | 'onboarding' | 'active';

export const CREATOR_STRIPE_CONNECT_STATUS_LABELS: Record<CreatorStripeConnectStatus, string> = {
  not_connected: 'Не подключено',
  onboarding: 'Онбординг не завершён',
  active: 'Подключено',
};

/** Короткие статус-бейджи (админ-список и т.п.) — НЕ заменяют полные
 * объясняющие предложения в `CreatorPromoCard`/`CreatorStudioWidget`
 * (там разный смысл на верифицированный/активный статус для владельца
 * профиля, здесь — нейтральный бейдж для чужого списка). */
export const CREATOR_STATUS_LABELS: Record<CreatorStatus, string> = {
  verification_pending: 'На проверке',
  verified: 'Проверен',
  active: 'Активен',
  rejected: 'Отклонён',
  suspended: 'Приостановлен',
};

export const CREATOR_AD_FREQUENCY_LABELS: Record<CreatorAdFrequency, string> = {
  low: 'Низкая',
  balanced: 'Сбалансированная',
  high: 'Высокая',
};

/** Тот же список, что backend's `CREATOR_BLOCKABLE_AD_CATEGORIES`
 * (`backend/src/modules/creators/creators.types.ts`) — без `gambling`/
 * `adult`: платформа в принципе не размещает такую рекламу, это не просто
 * блокируемая creator'ом категория, а несуществующая. */
export const CREATOR_BLOCKABLE_AD_CATEGORIES = ['alcohol', 'political', 'financial'] as const;
export type CreatorBlockableAdCategory = (typeof CREATOR_BLOCKABLE_AD_CATEGORIES)[number];

export const CREATOR_BLOCKABLE_AD_CATEGORY_LABELS: Record<CreatorBlockableAdCategory, string> = {
  alcohol: 'Алкоголь',
  political: 'Политическая реклама',
  financial: 'Финансовые продукты',
};

export const MAX_ADDITIONAL_CATEGORIES = 5;

export interface CreatorEligibility {
  eligible: boolean;
  /** По подписчикам (`entities/follow`), не друзьям — см. AI_PLATFORM_
   * ROADMAP.md §85. */
  subscriberCount: number;
  requiredSubscribers: number;
  hasStarted: boolean;
}

export interface CreatorCategoryNode {
  id: string;
  slug: string;
  label: string;
  icon: string | null;
  children: CreatorCategoryNode[];
}

export interface CreatorCategoryAssignment {
  id: string;
  slug: string;
  label: string;
  isPrimary: boolean;
}

export interface CreatorProfile {
  id: string;
  userId: string;
  status: CreatorStatus;
  rejectionReason: string | null;
  verifiedAt: string | null;
  activatedAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  monetizationEnabled: boolean;
  adFrequency: CreatorAdFrequency;
  maxAdFrequencyRatio: number;
  blockedCategories: string[];
  blockedAdvertiserIds: string[];
  categories: CreatorCategoryAssignment[];
  stripeConnectStatus: CreatorStripeConnectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StartCreatorOnboardingInput {
  primaryCategoryId: string;
  additionalCategoryIds?: string[];
}

export interface UpdateCreatorSettingsInput {
  monetizationEnabled?: boolean;
  adFrequency?: CreatorAdFrequency;
  maxAdFrequencyRatio?: number;
  blockedCategories?: string[];
  blockedAdvertiserIds?: string[];
}

export interface CreatorIdentitySession {
  clientSecret: string;
}
