import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { StripeSubscriptionProvider } from './stripe-subscription-provider';

/**
 * Второй (и последний) входящий вебхук во всём проекте, наряду со
 * `StripeWebhookController` (`modules/orders`) — отдельный ENDPOINT и,
 * следовательно, отдельный signing secret (`STRIPE_SUBSCRIPTIONS_WEBHOOK_
 * SECRET`), Stripe выдаёт секрет на каждый endpoint отдельно. Без
 * `SessionAuthGuard` — Stripe не может пройти аутентификацию Таверны,
 * подлинность проверяется ПОДПИСЬЮ (см. `StripeSubscriptionProvider.
 * verifyWebhookSignature`), тот же принцип, что у `StripeWebhookController`.
 */
@Controller('webhooks/stripe-subscriptions')
export class SubscriptionWebhookController {
  constructor(
    private readonly provider: StripeSubscriptionProvider,
    private readonly billingService: BillingService,
  ) {}

  @Post()
  async handle(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    if (!request.rawBody || !signature) {
      throw new BadRequestException('Отсутствует тело запроса или подпись Stripe');
    }

    const event = this.provider.verifyWebhookSignature(request.rawBody, signature);
    if (!event) {
      throw new BadRequestException('Неверная подпись или необрабатываемое событие');
    }

    // `businessId` отсутствует только если чекаут-сессия/подписка была
    // создана мимо `BillingService.startCheckout` (не должно происходить —
    // `metadata.businessId`/`subscription_data.metadata` выставляются там
    // на каждом чекауте) — тихо игнорируем, а не 400, событие в любом
    // случае от настоящего Stripe (подпись уже проверена).
    if (!event.businessId) {
      return { received: true };
    }

    if (event.type === 'checkout.session.completed') {
      await this.billingService.handleCheckoutCompleted({
        businessId: event.businessId,
        stripeCustomerId: event.stripeCustomerId,
        stripeSubscriptionId: event.stripeSubscriptionId,
      });
    } else if (event.type === 'customer.subscription.updated' && event.status) {
      await this.billingService.handleSubscriptionUpdated({
        businessId: event.businessId,
        status: event.status,
        stripePriceId: event.stripePriceId,
        currentPeriodEnd: event.currentPeriodEnd,
      });
    } else if (event.type === 'customer.subscription.deleted') {
      await this.billingService.handleSubscriptionDeleted(event.businessId);
    }

    return { received: true };
  }
}
