import type { SelfServePaidTier } from './billing.types';

export interface CreateSubscriptionCheckoutInput {
  businessId: string;
  ownerId: string;
  tier: SelfServePaidTier;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateSubscriptionCheckoutResult {
  url: string;
}

export type SubscriptionWebhookEventType =
  'checkout.session.completed' | 'customer.subscription.updated' | 'customer.subscription.deleted';

export interface SubscriptionWebhookEvent {
  type: SubscriptionWebhookEventType;
  businessId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodEnd: Date | null;
  status: 'active' | 'past_due' | 'canceled' | null;
}

export interface SubscriptionSnapshot {
  status: 'active' | 'past_due' | 'canceled';
  stripePriceId: string | null;
  currentPeriodEnd: Date | null;
}

/**
 * Абстракция над платёжным провайдером для ПОДПИСОК — тот же приём, что
 * `PaymentProvider` (`modules/payments/payment-provider.ts`) для разовых
 * платежей за заказы: абстрактный класс, не `interface` (NestJS DI не
 * различает TS-интерфейсы в рантайме, они стираются при компиляции).
 * Отдельный от `PaymentProvider` класс — Stripe Checkout Sessions в режиме
 * `subscription` устроены иначе, чем `PaymentIntent`/Payment Element,
 * который использует `OrdersService`, и `BillingModule` не должен зависеть
 * от `PaymentsModule` ради пары общих строк создания клиента.
 */
export abstract class StripeSubscriptionProvider {
  /** `false`, если `STRIPE_SECRET_KEY` не задан — вызывающий код
   * (`BillingService.startCheckout`) в этом случае просто не предлагает
   * платный чекаут (Free/Enterprise остаются доступны), а не падает —
   * тот же контракт, что у `PaymentProvider.isConfigured()`. */
  abstract isConfigured(): boolean;

  /** Идемпотентно создаёт (если ещё не существуют) Stripe Product/Price для
   * каждого тира `PAID_PLAN_CATALOG` — см. `StripePlanBootstrapService`. */
  abstract ensurePlansBootstrapped(): Promise<void>;

  abstract createCheckoutSession(
    input: CreateSubscriptionCheckoutInput,
  ): Promise<CreateSubscriptionCheckoutResult>;

  /** `null`, если подпись неверна ИЛИ событие не входит в обрабатываемый
   * набор — тот же контракт, что `PaymentProvider.verifyWebhookSignature`. */
  abstract verifyWebhookSignature(
    payload: Buffer,
    signature: string,
  ): SubscriptionWebhookEvent | null;

  /** Обогащает `checkout.session.completed` данными подписки (Price/
   * `current_period_end`), которых сама Checkout Session не несёт без
   * `expand` — см. `BillingService.handleCheckoutCompleted`, единственный
   * потребитель. `null`, если Stripe не настроен или подписка не найдена. */
  abstract getSubscriptionSnapshot(subscriptionId: string): Promise<SubscriptionSnapshot | null>;

  /** Меняет тариф УЖЕ ОПЛАЧИВАЕМОЙ подписки на другой платный тир —
   * платёжный метод уже привязан к Stripe Customer с первого чекаута, новый
   * `Checkout Session` не нужен (см. `BillingService.selectPlan`: "смена
   * тарифа в любой момент" без второй параллельной подписки/двойного
   * списания). Прорейтит остаток текущего периода (`proration_behavior:
   * 'create_prorations'`) — Stripe сам выставит корректирующую сумму в
   * следующем инвойсе. */
  abstract updateSubscriptionPrice(
    subscriptionId: string,
    tier: SelfServePaidTier,
  ): Promise<SubscriptionSnapshot>;

  /** Отменяет подписку НЕМЕДЛЕННО (не "в конце периода") — см.
   * `BillingService.selectPlan`'s комментарий про переход на Free: без
   * Customer Portal/UI для "останется активной до X" немедленная отмена —
   * единственное поведение, которое не оставляет неоднозначности между
   * тем, что показывает наш `BusinessSubscription.status` и тем, что
   * реально списывает Stripe. */
  abstract cancelSubscription(subscriptionId: string): Promise<void>;
}
