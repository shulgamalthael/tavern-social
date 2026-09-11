import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { AdCampaignsService } from '@/modules/advertising/ad-campaigns.service';
import { AppointmentsService } from '@/modules/appointments/appointments.service';
import { NativeAdCampaignsService } from '@/modules/native-ads/native-ad-campaigns.service';
import { PaymentProvider } from '@/modules/payments/payment-provider';
import { PostBoostsService } from '@/modules/posts/post-boosts.service';
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
    private readonly appointmentsService: AppointmentsService,
    private readonly adCampaignsService: AdCampaignsService,
    private readonly postBoostsService: PostBoostsService,
    private readonly nativeAdCampaignsService: NativeAdCampaignsService,
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
      // `metadata` — то, что САМИ мы передали в `createPaymentIntent`
      // (`OrdersService.createFromCart`/`AppointmentsService.
      // createFromRequest`), Stripe только возвращает его нетронутым — по
      // ключу, а не пробным поиском по всем таблицам подряд, однозначно
      // известно, кому доставить событие: `orderId` xor `appointmentId` xor
      // `campaignId` xor `postBoostId` xor `nativeCampaignId` xor
      // `adTopUpId`, никогда два сразу (у каждого `PaymentIntent` ровно
      // один владелец). `campaignId` (сайтовая реклама) и `nativeCampaignId`
      // (реклама в ленте creator'ов, см. `NativeAdCampaignsService.
      // submitForReview`) — намеренно разные ключи, а не общий `campaignId`
      // для обеих независимых кампаний. `adTopUpId` проверяется ДО
      // `campaignId` — доплата (`AdCampaignsService.requestTopUp`) кладёт в
      // metadata ОБА ключа (см. её комментарий, `campaignId` там нужен
      // только для читаемости в Stripe Dashboard), иначе она молча
      // маршрутизировалась бы как обычный платёж за саму кампанию.
      if (event.metadata.orderId) {
        await this.ordersService.markPaidByPaymentIntent(event.paymentIntentId);
      } else if (event.metadata.appointmentId) {
        await this.appointmentsService.markPaidByPaymentIntent(event.paymentIntentId);
      } else if (event.metadata.adTopUpId) {
        await this.adCampaignsService.markTopUpPaidByPaymentIntent(
          event.paymentIntentId,
          event.metadata.adTopUpId,
        );
      } else if (event.metadata.campaignId) {
        await this.adCampaignsService.markPaidByPaymentIntent(event.paymentIntentId);
      } else if (event.metadata.postBoostId) {
        await this.postBoostsService.markPaidByPaymentIntent(event.paymentIntentId);
      } else if (event.metadata.nativeCampaignId) {
        await this.nativeAdCampaignsService.markPaidByPaymentIntent(event.paymentIntentId);
      }
    }
    // `payment_intent.payment_failed` — намеренно no-op, см. комментарий
    // `OrdersService.markPaidByPaymentIntent`.

    return { received: true };
  }
}
