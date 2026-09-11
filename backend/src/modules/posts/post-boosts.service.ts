import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PaymentAmountTooLowError } from '@/modules/payments/payments.types';
import { PaymentProvider } from '@/modules/payments/payment-provider';
import type { CreatePostBoostDto } from './dto/create-post-boost.dto';

/**
 * Instagram-style продвижение поста (AI_PLATFORM_ROADMAP.md §73) —
 * единственный способ, которым пост обходит relationship-based фильтр
 * главной ленты (`PostsService.listFeed`): пока у поста есть строка
 * `paymentStatus: 'paid'` с `endsAt` в будущем, он виден там любому
 * пользователю, не только друзьям автора/участникам его сообществ. См.
 * комментарий модели `PostBoost` в schema.prisma — почему это отдельная,
 * гораздо более простая модель, а не переиспользование `AdCampaign`/
 * `AdEngineService`.
 *
 * Оплата — четвёртый вызывающий уже существующего `PaymentProvider`
 * (`createPaymentIntent`/`verifyWebhookSignature`), рядом с `Order`/
 * `Appointment`/`AdCampaign` — ни одной новой строчки интеграции со Stripe.
 */
@Injectable()
export class PostBoostsService {
  private readonly logger = new Logger(PostBoostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProvider: PaymentProvider,
  ) {}

  /** Создаёт `PaymentIntent` на весь `budgetCents` и возвращает `clientSecret`
   * для Stripe Elements на frontend (тот же самый компонент `StripePaymentForm`,
   * что уже используют `CartWidget`/`AdvertisingSection`) — активация
   * (`startsAt`/`endsAt`) происходит только по вебхуку, см.
   * `markPaidByPaymentIntent`, не здесь: до реального подтверждения оплаты
   * назначать даты действия было бы нечестно. */
  async create(
    postId: string,
    userId: string,
    dto: CreatePostBoostDto,
  ): Promise<{ clientSecret: string }> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
    });
    if (!post) {
      throw new NotFoundException('Запись не найдена');
    }
    if (post.authorId !== userId) {
      throw new ForbiddenException('Продвигать можно только свою запись');
    }

    const activeBoost = await this.prisma.postBoost.findFirst({
      where: { postId, paymentStatus: 'paid', endsAt: { gt: new Date() } },
      select: { id: true },
    });
    if (activeBoost) {
      throw new BadRequestException('Эта запись уже продвигается');
    }

    if (!this.paymentProvider.isConfigured()) {
      throw new BadRequestException('Приём оплаты временно недоступен, попробуйте позже');
    }

    const boost = await this.prisma.postBoost.create({
      data: {
        postId,
        userId,
        budgetCents: dto.budgetCents,
        currency: dto.currency,
        durationDays: dto.durationDays,
      },
    });

    let paymentIntentId: string;
    let clientSecret: string;
    try {
      const result = await this.paymentProvider.createPaymentIntent({
        amountCents: dto.budgetCents,
        currency: dto.currency,
        metadata: { postBoostId: boost.id },
      });
      paymentIntentId = result.paymentIntentId;
      clientSecret = result.clientSecret;
    } catch (error) {
      const message =
        error instanceof PaymentAmountTooLowError
          ? 'Бюджет продвижения слишком мал для оплаты'
          : 'Не удалось создать платёж — попробуйте позже';
      this.logger.error(
        `Не удалось создать PaymentIntent для продвижения ${boost.id}: ${(error as Error).message}`,
      );
      throw new BadRequestException(message);
    }

    await this.prisma.postBoost.update({
      where: { id: boost.id },
      data: { stripePaymentIntentId: paymentIntentId },
    });

    return { clientSecret };
  }

  /** Вызывается только вебхуком Stripe (`StripeWebhookController`) — тот же
   * принцип, что `OrdersService`/`AdCampaignsService.markPaidByPaymentIntent`.
   * Именно здесь, а не в `create`, назначаются `startsAt`/`endsAt` — до этого
   * момента платёж мог не состояться вообще. */
  async markPaidByPaymentIntent(paymentIntentId: string): Promise<void> {
    const boost = await this.prisma.postBoost.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (!boost) {
      this.logger.warn(`Вебхук Stripe для неизвестного продвижения поста ${paymentIntentId}`);
      return;
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + boost.durationDays * 24 * 60 * 60 * 1000);
    await this.prisma.postBoost.update({
      where: { id: boost.id },
      data: { paymentStatus: 'paid', startsAt, endsAt },
    });
  }
}
