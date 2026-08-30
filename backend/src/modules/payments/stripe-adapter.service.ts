import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { AppConfig } from '@/config/configuration';
import { isSupportedCurrencyCode } from '@/modules/currencies/currencies';
import { PaymentProvider } from './payment-provider';
import {
  PaymentAmountTooLowError,
  PaymentUnsupportedCurrencyError,
  type CreatePaymentIntentInput,
  type PaymentIntentResult,
  type PaymentWebhookEvent,
} from './payments.types';

const HANDLED_EVENT_TYPES = new Set(['payment_intent.succeeded', 'payment_intent.payment_failed']);

/**
 * Единственная реализация `PaymentProvider` сегодня — один Stripe-аккаунт
 * платформы обслуживает оплату для ВСЕХ бизнесов Таверны (не per-business
 * Stripe Connect — см. ROADMAP.md §3.9, тот уровень явно отложен до задачи
 * Marketplace). Ключи — из `.env` (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_
 * SECRET`, см. `configuration.ts`), никогда не жёстко закодированы и никогда
 * не долетают до frontend (тот получает только `clientSecret` конкретного
 * платежа, см. `PaymentIntentResult`).
 */
@Injectable()
export class StripeAdapter extends PaymentProvider {
  private readonly logger = new Logger(StripeAdapter.name);
  private readonly stripe: Stripe | null;
  private readonly webhookSecret: string | undefined;

  constructor(configService: ConfigService) {
    super();
    const config = configService.get<AppConfig>('app')!;
    this.webhookSecret = config.stripeWebhookSecret;
    this.stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;

    if (!this.stripe) {
      this.logger.warn(
        'STRIPE_SECRET_KEY не задан — оплата отключена, заказы создаются без PaymentIntent',
      );
    }
  }

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  /** `automatic_payment_methods: { enabled: true }` — Stripe сам решает,
   * какие способы оплаты показать в Payment Element (карта, Apple Pay,
   * Google Pay и т. д.) исходя из браузера/устройства плательщика и
   * настроек аккаунта, вместо ручного перечисления `payment_method_types`
   * (устаревший подход, требующий правки кода на каждый новый способ
   * оплаты). Apple Pay в этом списке появится только для доменов,
   * зарегистрированных в Stripe (нужен настоящий HTTPS-домен — не работает
   * на `localhost`/системных сабдоменах, см. ROADMAP.md §3.9). */
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    if (!this.stripe) {
      throw new Error(
        'Stripe не настроен — вызывающий код обязан проверить isConfigured() перед вызовом',
      );
    }

    // Defense-in-depth (Currency System, ROADMAP.md §8, "Stripe mismatch
    // protection") — `input.currency` уже должна быть провалидирована на
    // границе, где её задал пользователь (`@IsIn(SUPPORTED_CURRENCY_CODES)`
    // на `CreateBusinessDto`/`UpdateBusinessDto`), а сама архитектура
    // (Order/Appointment всегда снимают снэпшот именно `Business.currency`,
    // не принимают код валюты откуда-то ещё) структурно не даёт разным
    // частям одного платежа разойтись по валюте. Проверка здесь — на
    // случай будущей ошибки в этой цепочке, не потому что есть известный
    // сценарий, когда она сработает сегодня.
    if (!isSupportedCurrencyCode(input.currency)) {
      throw new PaymentUnsupportedCurrencyError(input.currency);
    }

    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await this.stripe.paymentIntents.create({
        amount: input.amountCents,
        currency: input.currency.toLowerCase(),
        metadata: input.metadata,
        automatic_payment_methods: { enabled: true },
      });
    } catch (error) {
      // Частый, вполне ожидаемый случай — Stripe требует минимум ~$0.50
      // (эквивалент в валюте платежа) за платёж, недостижимо для дешёвых
      // тестовых товаров и вполне реально для настоящих грошовых позиций.
      // Перебрасываем провайдеро-независимой ошибкой (см. её комментарий в
      // `payments.types.ts`), чтобы `OrdersService` мог отличить этот
      // случай от произвольного сбоя Stripe, не зная про `Stripe.errors.*`.
      if (
        error instanceof Stripe.errors.StripeInvalidRequestError &&
        error.code === 'amount_too_small'
      ) {
        throw new PaymentAmountTooLowError(error.message);
      }
      throw error;
    }

    if (!paymentIntent.client_secret) {
      // Практически недостижимо (Stripe всегда возвращает client_secret при
      // создании), но лучше явная ошибка, чем `undefined`, просочившийся в
      // ответ API как валидный `clientSecret`.
      throw new Error('Stripe не вернул client_secret для нового PaymentIntent');
    }

    return { paymentIntentId: paymentIntent.id, clientSecret: paymentIntent.client_secret };
  }

  /** Возврат целиком (см. `PaymentProvider.refundPayment`). Идемпотентно на
   * стороне Stripe — если возврат уже был сделан (повторный клик владельца,
   * гонка двух параллельных запросов), Stripe отвечает `charge_already_
   * refunded`, а не создаёт второй возврат; это ровно то состояние, которого
   * и добивался вызывающий код, поэтому не пробрасываем это как ошибку. */
  async refundPayment(paymentIntentId: string): Promise<void> {
    if (!this.stripe) {
      throw new Error(
        'Stripe не настроен — вызывающий код обязан проверить isConfigured() перед вызовом',
      );
    }

    try {
      await this.stripe.refunds.create({ payment_intent: paymentIntentId });
    } catch (error) {
      if (
        error instanceof Stripe.errors.StripeInvalidRequestError &&
        error.code === 'charge_already_refunded'
      ) {
        return;
      }
      throw error;
    }
  }

  verifyWebhookSignature(payload: Buffer, signature: string): PaymentWebhookEvent | null {
    if (!this.stripe || !this.webhookSecret) return null;

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error) {
      this.logger.warn(`Неверная подпись Stripe-вебхука: ${(error as Error).message}`);
      return null;
    }

    if (!HANDLED_EVENT_TYPES.has(event.type)) return null;

    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    return {
      type: event.type as PaymentWebhookEvent['type'],
      paymentIntentId: paymentIntent.id,
      metadata: paymentIntent.metadata,
    };
  }
}
