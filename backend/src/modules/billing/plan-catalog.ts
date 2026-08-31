import type { SelfServePaidTier } from './billing.types';

export interface PaidPlanCatalogEntry {
  tier: SelfServePaidTier;
  /** Стабильный, человекочитаемый Stripe `lookup_key` — никогда не
   * регенерируется, используется и для bootstrap'а (`StripePlanBootstrap
   * Service`), и для поиска актуального Price при чекауте
   * (`StripeSubscriptionAdapter.createCheckoutSession`). Это и есть
   * идемпотентность bootstrap'а: Stripe сам отвечает "существует ли Price с
   * этим ключом", в нашей БД для этого не нужен отдельный флаг. */
  stripeLookupKey: string;
  /** ПЛЕЙСХОЛДЕР — оператор обязан поправить реальную сумму в Stripe
   * Dashboard (Products → цена) до выхода в прод, см. предупреждение в
   * `StripePlanBootstrapService`. */
  placeholderAmountCents: number;
  currency: string;
  productName: string;
}

export const PAID_PLAN_CATALOG: readonly PaidPlanCatalogEntry[] = [
  {
    tier: 'starter',
    stripeLookupKey: 'tavern_starter_monthly',
    placeholderAmountCents: 1900,
    currency: 'usd',
    productName: 'Tavern Starter',
  },
  {
    tier: 'business',
    stripeLookupKey: 'tavern_business_monthly',
    placeholderAmountCents: 4900,
    currency: 'usd',
    productName: 'Tavern Business',
  },
  {
    tier: 'scale',
    stripeLookupKey: 'tavern_scale_monthly',
    placeholderAmountCents: 14900,
    currency: 'usd',
    productName: 'Tavern Scale',
  },
];
