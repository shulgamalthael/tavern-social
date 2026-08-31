/** Зеркалит `PlanTier` backend (`schema.prisma`) — frontend и backend не
 * делят типы (разные TS-проекты), backend остаётся источником истины
 * валидации, тот же приём, что у `BusinessCategory`/`BusinessCapability`
 * (см. `entities/business/model/types.ts`). */
export type PlanTier = 'free' | 'starter' | 'business' | 'scale' | 'enterprise';

/** Только 3 самостоятельных платных тира — `enterprise` не проходит через
 * Stripe Checkout (см. `PlanSelectorWidget`, кнопка "Связаться с нами"). */
export type SelfServePaidTier = 'starter' | 'business' | 'scale';

/** Тиры, доступные через единый `selectPlan` ("смена тарифа в любой
 * момент") — `enterprise` не входит, у него отдельный `recordEnterpriseInquiry`. */
export type SelectablePlanTier = 'free' | SelfServePaidTier;

export type SubscriptionStatus = 'active' | 'incomplete' | 'past_due' | 'canceled';

/** `isGateOpen` считается backend'ом (`BillingService.getStatus`), а не
 * выводится здесь из `tier`/`status` порознь — один источник истины для
 * гейта конструктора (`app/(protected)/business/[id]/edit/page.tsx`). */
export interface BillingStatus {
  tier: PlanTier | null;
  status: SubscriptionStatus | null;
  isGateOpen: boolean;
}

export type PlanEventType =
  | 'free_selected'
  | 'checkout_started'
  | 'checkout_completed'
  | 'checkout_canceled'
  | 'subscription_updated'
  | 'subscription_canceled'
  | 'enterprise_inquiry';

export interface PlanEvent {
  id: string;
  type: PlanEventType;
  tier: PlanTier | null;
  createdAt: string;
}
