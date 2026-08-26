export interface CreatePaymentIntentInput {
  amountCents: number;
  currency: string;
  /** Произвольные пары ключ-значение, которые провайдер обязан вернуть
   * нетронутыми в вебхук-событии по этому платежу (см. `PaymentWebhookEvent.
   * metadata`) — единственный способ связать платёж с заказом на нашей
   * стороне (`orderId`), не завися от деталей конкретного провайдера. */
  metadata: Record<string, string>;
}

export interface PaymentIntentResult {
  paymentIntentId: string;
  /** Отдаётся клиенту напрямую (см. `OrderDto.clientSecret`) — секретом в
   * смысле «нельзя закоммитить» не является: он одноразовый, привязан к
   * конкретному `PaymentIntent`, и без него Stripe Elements физически не
   * может собрать форму оплаты. */
  clientSecret: string;
}

/** Почему `createFromCart` не смог создать `PaymentIntent` (см. `OrderDto.
 * paymentUnavailableReason`) — раньше это молча приводило к заказу без
 * `clientSecret`, ничем не отличаясь для посетителя от «оплата не нужна»,
 * даже когда Stripe реально настроен, но упал по конкретной, часто вполне
 * ожидаемой причине (например, сумма заказа меньше минимума Stripe —
 * ~$0.50, см. `PaymentAmountTooLowError` ниже). Владелец-only причины
 * (`not_configured`) отличаются от причин на стороне конкретного платежа
 * (`amount_too_low`/`provider_error`), чтобы frontend мог показать разный
 * текст подсказки. */
export type PaymentUnavailableReason = 'not_configured' | 'amount_too_low' | 'provider_error';

/** Провайдеро-независимый сигнал «сумма слишком мала для оплаты» —
 * `StripeAdapter` бросает именно этот класс (не голый `Error`), когда
 * распознаёт код Stripe `amount_too_small`, чтобы `OrdersService` мог
 * отличить этот конкретный, предсказуемый случай от произвольного сбоя
 * провайдера (`provider_error`) без знания деталей Stripe API. */
export class PaymentAmountTooLowError extends Error {}

/** Defense-in-depth (Currency System, ROADMAP.md §8, "Stripe mismatch
 * protection") — `StripeAdapter` бросает это, если `input.currency`
 * почему-то не входит в `SUPPORTED_CURRENCY_CODES`, хотя всё вызывающие
 * пути (`Business.currency`, снятое на `Order`/`Appointment`) уже обязаны
 * были провалидировать код раньше. Не должно происходить сегодня — если
 * происходит, это программная ошибка где-то выше по цепочке, не то, что
 * можно исправить повторной попыткой, поэтому маппится в `OrderDto.
 * paymentUnavailableReason: 'provider_error'`, тот же путь, что и у любого
 * непредвиденного сбоя провайдера. */
export class PaymentUnsupportedCurrencyError extends Error {
  constructor(currency: string) {
    super(`Неподдерживаемая валюта: ${currency}`);
  }
}

export type PaymentWebhookEventType = 'payment_intent.succeeded' | 'payment_intent.payment_failed';

/** Провайдеро-независимая форма события — `StripeWebhookController` не
 * должен знать про `Stripe.Event`, только про эту форму (см. `PaymentProvider.
 * verifyWebhookSignature`, которая и делает перевод). */
export interface PaymentWebhookEvent {
  type: PaymentWebhookEventType;
  paymentIntentId: string;
  metadata: Record<string, string>;
}
