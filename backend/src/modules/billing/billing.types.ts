import type { PlanEventType, PlanTier, SubscriptionStatus } from '@prisma/client';

export type { PlanEventType, PlanTier, SubscriptionStatus };

/** Только 3 самостоятельных платных тира этой итерации — `enterprise` не
 * проходит через Stripe Checkout вообще (см. `BillingService.
 * recordEnterpriseInquiry`), `free` не требует Stripe. */
export type SelfServePaidTier = 'starter' | 'business' | 'scale';

export const SELF_SERVE_PAID_TIERS: readonly SelfServePaidTier[] = ['starter', 'business', 'scale'];

/** Тиры, доступные через единый `POST .../billing/select-plan` ("смена
 * тарифа в любой момент", см. `BillingService.selectPlan`) — `enterprise`
 * туда не входит намеренно, у него свой `enterprise-inquiry`, никогда не
 * открывающий гейт сам по себе (см. `BillingService.recordEnterpriseInquiry`). */
export type SelectablePlanTier = 'free' | SelfServePaidTier;

export const SELECTABLE_PLAN_TIERS: readonly SelectablePlanTier[] = [
  'free',
  ...SELF_SERVE_PAID_TIERS,
];

/** Отдаётся владельцу бизнеса как ответ на `GET .../billing/status` —
 * `isGateOpen` считается на backend (не на frontend по `tier`/`status`
 * порознь), чтобы у гейта конструктора был ровно один источник истины. */
export interface BillingStatusDto {
  tier: PlanTier | null;
  status: SubscriptionStatus | null;
  isGateOpen: boolean;
}

/** `checkoutUrl` присутствует, только если владельцу впервые нужно
 * привязать способ оплаты (не было живой Stripe-подписки) — иначе смена
 * тарифа происходит сразу же (`BillingService.selectPlan`), без редиректа. */
export interface SelectPlanResultDto {
  status: BillingStatusDto;
  checkoutUrl?: string;
}

export interface PlanEventDto {
  id: string;
  type: PlanEventType;
  tier: PlanTier | null;
  createdAt: string;
}
