import type { CreatorAdFrequency, CreatorStatus, CreatorStripeConnectStatus } from '@prisma/client';
import type { PublicProfile } from '@/modules/users/users.types';

/** Максимум дополнительных категорий помимо основной (корневой план фичи
 * §4 второго follow-up сообщения владельца — "например: максимум 5"). */
export const MAX_ADDITIONAL_CATEGORIES = 5;

/** Курируемый список блокируемых категорий РЕКЛАМЫ (корневой план фичи §15 —
 * "Block categories": Gambling/Alcohol/Political/Adult/Financial и т. п.) —
 * НЕ то же самое, что `CreatorCategory` (категория деятельности САМОГО
 * creator'а). Плоский фиксированный список строк, не enum/таблица — тот же
 * "string[], расширяется без миграции" приём, что и у
 * `CreatorProfile.blockedCategories`/`Business.capabilities`; конфигурируем
 * его здесь, одним местом, а не в каждом вызывающем отдельно.
 *
 * Без `gambling`/`adult` — платформа в принципе не размещает такую рекламу
 * (владелец, 2026-09-06), поэтому это не просто "creator может заблокировать
 * категорию", а "категории не существует вообще": `CreateNativeAdCampaignDto.
 * adCategory` валидируется `@IsIn(CREATOR_BLOCKABLE_AD_CATEGORIES)` этим же
 * списком, так что рекламодатель физически не может создать кампанию с этой
 * категорией — один источник правды закрывает обе стороны сразу. */
export const CREATOR_BLOCKABLE_AD_CATEGORIES = ['alcohol', 'political', 'financial'] as const;
export type CreatorBlockableAdCategory = (typeof CREATOR_BLOCKABLE_AD_CATEGORIES)[number];

/** Чисто вычисляемое — см. `CreatorsService.getEligibility`: ничего из этого
 * не хранится, `eligible` — просто `subscriberCount >= requiredSubscribers`.
 * По подписчикам (`Subscription`), не друзьям (`Friendship`) — см. §85. */
export interface CreatorEligibilityDto {
  eligible: boolean;
  subscriberCount: number;
  requiredSubscribers: number;
  /** `true`, если у пользователя уже есть `CreatorProfile` (начал/прошёл
   * онбординг) — отдельно от `eligible`, чтобы фронтенд не путал "ещё не
   * набрал друзей" с "уже подал заявку". */
  hasStarted: boolean;
}

/** Один узел дерева категорий (`GET /creators/categories`) — рекурсивный,
 * строится один раз в `CreatorCategoriesService.listTree()` из плоской
 * таблицы по `parentId`. */
export interface CreatorCategoryNodeDto {
  id: string;
  slug: string;
  label: string;
  icon: string | null;
  children: CreatorCategoryNodeDto[];
}

/** Плоская строка для админ-CRUD (`GET admin/creators/categories` и ответы
 * create/update) — в отличие от `CreatorCategoryNodeDto` (рекурсивное
 * дерево для онбординга), здесь `parentId`/`order` нужны РЕДАКТИРУЕМЫМИ
 * полями формы, а `depth` — чтобы фронтенд мог отрисовать отступы плоским
 * списком, не строя дерево на клиенте заново. */
export interface AdminCreatorCategoryDto {
  id: string;
  slug: string;
  label: string;
  icon: string | null;
  parentId: string | null;
  order: number;
  depth: number;
}

export interface CreatorCategoryAssignmentDto {
  id: string;
  slug: string;
  label: string;
  isPrimary: boolean;
}

export interface CreatorProfileDto {
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
  /** Реальные выплаты через Stripe Connect (Phase 5, AI_PLATFORM_ROADMAP.md
   * §83) — `stripeConnectedAccountId` НЕ отдаётся фронтенду (внутренний id
   * Stripe, фронтенду не нужен), только текущий статус. */
  stripeConnectStatus: CreatorStripeConnectStatus;
  categories: CreatorCategoryAssignmentDto[];
  createdAt: string;
  updatedAt: string;
}

/** `GET /creators/identity-session`'s ответ — `clientSecret` идёт прямо во
 * `stripe.verifyIdentity(clientSecret)` на фронтенде (тот же Stripe.js,
 * который уже используется для `PaymentIntent`, см. `StripePaymentForm`). */
export interface CreatorIdentitySessionDto {
  clientSecret: string;
}

/** Владелец-facing (не путать с `AdminCreatorListItemDto` в
 * `admin-creators.controller.ts`) сокращённый вид креатора в списке
 * администратора. */
export interface AdminCreatorListItemDto {
  id: string;
  status: CreatorStatus;
  rejectionReason: string | null;
  suspendedReason: string | null;
  user: PublicProfile;
  primaryCategory: string | null;
  createdAt: string;
}
