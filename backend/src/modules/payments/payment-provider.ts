import type {
  CreatePaymentIntentInput,
  PaymentIntentResult,
  PaymentWebhookEvent,
} from './payments.types';

/**
 * Абстракция над платёжным провайдером (см. ROADMAP.md §3.9) — `OrdersService`
 * зависит только от этого класса, не от Stripe напрямую. Сегодня единственная
 * реализация — `StripeAdapter`, тот же приём, что и `DomainVerificationProvider`
 * в `modules/domains` (абстрактный класс, а не `interface` — у NestJS DI нет
 * рантайм-токенов для чистых TS-интерфейсов, они стираются при компиляции).
 */
export abstract class PaymentProvider {
  /** `false`, если ключи провайдера не заданы в `.env` (см. `env.validation.
   * ts`) — вызывающий код (`OrdersService.createFromCart`) в этом случае
   * просто не создаёт `PaymentIntent`, заказ остаётся заявкой без оплаты
   * (тот же MVP-путь, что был единственным до появления Stripe), а не падает
   * с ошибкой. */
  abstract isConfigured(): boolean;

  abstract createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult>;

  /** `null`, если подпись неверна ИЛИ событие провайдера не входит в
   * `PaymentWebhookEventType` (например, Stripe шлёт десятки типов событий,
   * которые нам не нужны — `StripeWebhookController` должен их тихо
   * игнорировать, а не пытаться обработать). */
  abstract verifyWebhookSignature(payload: Buffer, signature: string): PaymentWebhookEvent | null;
}
