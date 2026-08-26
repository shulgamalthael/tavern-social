import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentProvider } from '@/modules/payments/payment-provider';
import { OrdersService } from './orders.service';

/**
 * Единственный входящий вебхук во всём проекте — Stripe уведомляет о
 * событиях платежа асинхронно, отдельно от ответа на `createPaymentIntent`
 * (см. `OrdersService.createFromCart`): подтверждение оплаты происходит в
 * браузере покупателя (Stripe Elements), backend узнаёт об успехе только
 * отсюда, а не от самого клиента — клиентское подтверждение никогда не
 * считается источником истины для денег (тот же принцип, что и везде в этом
 * проекте: серверная сторона — единственный авторитет).
 *
 * Без `SessionAuthGuard` (Stripe не может пройти аутентификацию Таверны) —
 * подлинность запроса проверяется ПОДПИСЬЮ (`Stripe-Signature` заголовок +
 * `STRIPE_WEBHOOK_SECRET`, см. `PaymentProvider.verifyWebhookSignature`),
 * это единственный рубеж доступа сюда. Требует `request.rawBody` (см.
 * `main.ts`, `rawBody: true`) — распарсенный `JSON.parse` body дал бы другую
 * подпись HMAC, даже если содержимое посимвольно совпадает.
 */
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private readonly paymentProvider: PaymentProvider,
    private readonly ordersService: OrdersService,
  ) {}

  @Post()
  async handle(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    if (!request.rawBody || !signature) {
      throw new BadRequestException('Отсутствует тело запроса или подпись Stripe');
    }

    const event = this.paymentProvider.verifyWebhookSignature(request.rawBody, signature);
    if (!event) {
      // Неверная подпись — 400, не 401/403: это не «нет доступа», а «это
      // вообще не от Stripe» (или событие нам не интересно, см. `Handled
      // EventTypes` в `StripeAdapter`) — оба случая одинаково безопасно
      // проигнорировать без разглашения деталей.
      throw new BadRequestException('Неверная подпись или необрабатываемое событие');
    }

    if (event.type === 'payment_intent.succeeded') {
      await this.ordersService.markPaidByPaymentIntent(event.paymentIntentId);
    }
    // `payment_intent.payment_failed` — намеренно no-op, см. комментарий
    // `OrdersService.markPaidByPaymentIntent`.

    return { received: true };
  }
}
