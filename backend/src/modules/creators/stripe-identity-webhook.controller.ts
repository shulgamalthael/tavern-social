import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CreatorIdentityService } from './creator-identity.service';
import { CreatorsService } from './creators.service';

/**
 * ТРЕТИЙ входящий Stripe-вебхук во всём проекте, наряду со
 * `StripeWebhookController` (`modules/orders`) и `SubscriptionWebhookController`
 * (`modules/billing`) — отдельный endpoint, отдельный signing secret
 * (`STRIPE_IDENTITY_WEBHOOK_SECRET`), тот же принцип "Stripe выдаёт секрет на
 * каждый endpoint отдельно". Без `SessionAuthGuard` — подлинность проверяется
 * подписью (`CreatorIdentityService.parseWebhookEvent`), не сессией.
 */
@Controller('webhooks/stripe-identity')
export class StripeIdentityWebhookController {
  constructor(
    private readonly identityService: CreatorIdentityService,
    private readonly creatorsService: CreatorsService,
  ) {}

  @Post()
  async handle(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    if (!request.rawBody || !signature) {
      throw new BadRequestException('Отсутствует тело запроса или подпись Stripe');
    }

    const event = this.identityService.parseWebhookEvent(request.rawBody, signature);
    if (!event) {
      throw new BadRequestException('Неверная подпись или необрабатываемое событие');
    }

    await this.creatorsService.handleIdentityWebhookEvent(event);

    return { received: true };
  }
}
