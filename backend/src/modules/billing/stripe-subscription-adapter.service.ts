import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { AppConfig } from '@/config/configuration';
import { PAID_PLAN_CATALOG } from './plan-catalog';
import type { SelfServePaidTier } from './billing.types';
import {
  StripeSubscriptionProvider,
  type CreateSubscriptionCheckoutInput,
  type CreateSubscriptionCheckoutResult,
  type SubscriptionSnapshot,
  type SubscriptionWebhookEvent,
  type SubscriptionWebhookEventType,
} from './stripe-subscription-provider';

const HANDLED_EVENT_TYPES = new Set<string>([
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

/**
 * Единственная реализация `StripeSubscriptionProvider` — один Stripe-аккаунт
 * платформы, тот же single-tenant принцип, что у `StripeAdapter`
 * (`modules/payments`) для разовых платежей заказов. Свой собственный
 * `Stripe`-клиент (не переиспользует `StripeAdapter`'s) — держит
 * `BillingModule` независимым от `PaymentsModule`, тот же narrow-adapter
 * подход, что уже применён в проекте (`DomainVerificationProvider` и
 * `PaymentProvider` тоже не делят реализацию).
 */
@Injectable()
export class StripeSubscriptionAdapter extends StripeSubscriptionProvider {
  private readonly logger = new Logger(StripeSubscriptionAdapter.name);
  private readonly stripe: Stripe | null;
  private readonly webhookSecret: string | undefined;

  constructor(configService: ConfigService) {
    super();
    const config = configService.get<AppConfig>('app')!;
    this.webhookSecret = config.stripeSubscriptionsWebhookSecret;
    this.stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;

    if (!this.stripe) {
      this.logger.warn(
        'STRIPE_SECRET_KEY не задан — платные тарифы отключены, доступны Free/Enterprise',
      );
    }
  }

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  /** Для каждого тира `PAID_PLAN_CATALOG`: ищет активный Price по
   * `lookup_key` — если найден, пропускает (Stripe сам и есть
   * идемпотентность, в нашей БД не нужен флаг "уже создано"); если нет,
   * создаёт Product+Price с ПЛЕЙСХОЛДЕР-суммой и логирует явное
   * предупреждение — оператор обязан поправить реальную цену в Stripe
   * Dashboard до выхода в прод. Безопасно вызывать на каждом рестарте. */
  async ensurePlansBootstrapped(): Promise<void> {
    if (!this.stripe) return;

    for (const entry of PAID_PLAN_CATALOG) {
      const existing = await this.stripe.prices.list({
        lookup_keys: [entry.stripeLookupKey],
        active: true,
        limit: 1,
      });
      if (existing.data.length > 0) {
        this.logger.log(`Stripe price для тира "${entry.tier}" уже существует — пропускаем`);
        continue;
      }

      const product = await this.stripe.products.create({
        name: entry.productName,
        metadata: { tier: entry.tier },
      });
      await this.stripe.prices.create({
        product: product.id,
        unit_amount: entry.placeholderAmountCents,
        currency: entry.currency,
        recurring: { interval: 'month' },
        lookup_key: entry.stripeLookupKey,
      });
      this.logger.warn(
        `Создан ПЛЕЙСХОЛДЕР Stripe price для тира "${entry.tier}" — ` +
          `${(entry.placeholderAmountCents / 100).toFixed(2)} ${entry.currency.toUpperCase()}/мес. ` +
          `Поправьте реальную сумму в Stripe Dashboard до выхода в прод.`,
      );
    }
  }

  async createCheckoutSession(
    input: CreateSubscriptionCheckoutInput,
  ): Promise<CreateSubscriptionCheckoutResult> {
    if (!this.stripe) {
      throw new Error(
        'Stripe не настроен — вызывающий код обязан проверить isConfigured() перед вызовом',
      );
    }

    const price = await this.findActivePrice(input.tier);

    const metadata = {
      businessId: input.businessId,
      ownerId: input.ownerId,
      tier: input.tier,
    };

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.businessId,
      metadata,
      // Метадата и на самой Subscription (не только на Session) — вебхуки
      // `customer.subscription.updated`/`.deleted` присылают в качестве
      // `data.object` саму Subscription, у которой иначе не было бы связи
      // с нашим `businessId` без дополнительного похода в Stripe API.
      subscription_data: { metadata },
    });

    if (!session.url) {
      throw new Error('Stripe не вернул URL чекаут-сессии');
    }

    return { url: session.url };
  }

  /** Обогащает событие `checkout.session.completed` данными подписки
   * (Price/`current_period_end`) — Checkout Session сама их не несёт без
   * `expand`, а `expand` на входящем вебхук-payload недоступен (это не наш
   * API-запрос). Отдельный async-вызов, не часть `verifyWebhookSignature` —
   * та остаётся синхронной, тем же контрактом, что `PaymentProvider`'s. */
  async getSubscriptionSnapshot(subscriptionId: string): Promise<SubscriptionSnapshot | null> {
    if (!this.stripe) return null;

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    return this.toSnapshot(subscription);
  }

  /** Меняет цену УЖЕ существующей Stripe-подписки на другой платный тир —
   * см. `StripeSubscriptionProvider.updateSubscriptionPrice`'s комментарий:
   * платёжный метод уже есть, второй Checkout Session не нужен. */
  async updateSubscriptionPrice(
    subscriptionId: string,
    tier: SelfServePaidTier,
  ): Promise<SubscriptionSnapshot> {
    if (!this.stripe) {
      throw new Error(
        'Stripe не настроен — вызывающий код обязан проверить isConfigured() перед вызовом',
      );
    }

    const [subscription, price] = await Promise.all([
      this.stripe.subscriptions.retrieve(subscriptionId),
      this.findActivePrice(tier),
    ]);
    const currentItem = subscription.items.data[0];
    if (!currentItem) {
      throw new Error(`У подписки ${subscriptionId} нет ни одной позиции`);
    }

    const updated = await this.stripe.subscriptions.update(subscriptionId, {
      items: [{ id: currentItem.id, price: price.id }],
      proration_behavior: 'create_prorations',
    });
    return this.toSnapshot(updated);
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    if (!this.stripe) return;
    await this.stripe.subscriptions.cancel(subscriptionId);
  }

  private async findActivePrice(tier: SelfServePaidTier): Promise<Stripe.Price> {
    if (!this.stripe) {
      throw new Error(
        'Stripe не настроен — вызывающий код обязан проверить isConfigured() перед вызовом',
      );
    }

    const catalogEntry = PAID_PLAN_CATALOG.find((entry) => entry.tier === tier);
    if (!catalogEntry) {
      throw new Error(`Неизвестный платный тир: ${tier}`);
    }

    const prices = await this.stripe.prices.list({
      lookup_keys: [catalogEntry.stripeLookupKey],
      active: true,
      limit: 1,
    });
    const price = prices.data[0];
    if (!price) {
      throw new Error(`Stripe price для тира "${tier}" не найден — bootstrap ещё не отработал?`);
    }
    return price;
  }

  private toSnapshot(subscription: Stripe.Subscription): SubscriptionSnapshot {
    return {
      status: this.mapStripeStatus(subscription.status),
      stripePriceId: subscription.items.data[0]?.price.id ?? null,
      currentPeriodEnd: subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000)
        : null,
    };
  }

  private mapStripeStatus(status: Stripe.Subscription.Status): 'active' | 'past_due' | 'canceled' {
    if (status === 'active' || status === 'trialing') return 'active';
    if (status === 'past_due' || status === 'unpaid') return 'past_due';
    return 'canceled';
  }

  verifyWebhookSignature(payload: Buffer, signature: string): SubscriptionWebhookEvent | null {
    if (!this.stripe || !this.webhookSecret) return null;

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error) {
      this.logger.warn(`Неверная подпись Stripe-вебхука подписок: ${(error as Error).message}`);
      return null;
    }

    if (!HANDLED_EVENT_TYPES.has(event.type)) return null;

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      return {
        type: event.type as SubscriptionWebhookEventType,
        businessId: session.metadata?.businessId ?? session.client_reference_id ?? null,
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
        stripeSubscriptionId:
          typeof session.subscription === 'string' ? session.subscription : null,
        stripePriceId: null,
        currentPeriodEnd: null,
        status: null,
      };
    }

    const subscription = event.data.object as Stripe.Subscription;
    return {
      type: event.type as SubscriptionWebhookEventType,
      businessId: subscription.metadata?.businessId ?? null,
      stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : null,
      stripeSubscriptionId: subscription.id,
      ...this.toSnapshot(subscription),
    };
  }
}
