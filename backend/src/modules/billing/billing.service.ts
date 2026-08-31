import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@/config/configuration';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PlanSelectionEventService } from './plan-selection-event.service';
import { StripeSubscriptionProvider } from './stripe-subscription-provider';
import type {
  BillingStatusDto,
  PlanEventDto,
  SelectablePlanTier,
  SelectPlanResultDto,
} from './billing.types';

/**
 * Владелец-CRUD тарифа одного бизнеса (Payment Plans v1) — вложен под
 * `/businesses/:businessId/billing`, тот же принцип, что у
 * `DiscountsService`/`AppointmentsService`: `assertOwnership` инлайн через
 * `prisma.business.findUnique`, не через отдельный `BusinessesService`
 * (billing не должен зависеть от `BusinessesModule` ради одной проверки).
 */
@Injectable()
export class BillingService {
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: PlanSelectionEventService,
    private readonly provider: StripeSubscriptionProvider,
    configService: ConfigService,
  ) {
    this.frontendUrl = configService.get<AppConfig>('app')!.frontendUrl;
  }

  async getStatus(businessId: string, ownerId: string): Promise<BillingStatusDto> {
    await this.assertOwnership(businessId, ownerId);

    const subscription = await this.prisma.businessSubscription.findUnique({
      where: { businessId },
      select: { tier: true, status: true },
    });

    return {
      tier: subscription?.tier ?? null,
      status: subscription?.status ?? null,
      // `incomplete` — чекаут создан, ждём вебхука: гейт конструктора
      // остаётся закрытым, отличая "оплата в процессе" от "тариф выбран".
      isGateOpen: subscription !== null && subscription.status !== 'incomplete',
    };
  }

  /**
   * Единая точка входа "сменить тариф в любой момент" — не только на
   * гейте после создания бизнеса. Три пути в зависимости от текущего
   * состояния:
   *
   * 1. `tier: 'free'` — если есть живая Stripe-подписка (`active`/
   *    `past_due`), отменяем её НЕМЕДЛЕННО (см. `StripeSubscriptionProvider.
   *    cancelSubscription`'s комментарий про то, почему не "в конце
   *    периода"), затем переключаем на Free.
   * 2. Платный тир, и уже есть живая Stripe-подписка (переключение
   *    Starter↔Business↔Scale) — меняем ЦЕНУ существующей подписки
   *    (`updateSubscriptionPrice`), без нового Checkout Session: платёжный
   *    метод уже привязан с первой оплаты, второй чекаут создал бы вторую
   *    параллельную подписку и двойное списание.
   * 3. Платный тир, и живой подписки нет (первый платный тариф после Free,
   *    либо предыдущая подписка уже отменена) — нужен Checkout Session
   *    (привязать способ оплаты), `checkoutUrl` в ответе.
   */
  async selectPlan(
    businessId: string,
    ownerId: string,
    tier: SelectablePlanTier,
  ): Promise<SelectPlanResultDto> {
    await this.assertOwnership(businessId, ownerId);

    const current = await this.prisma.businessSubscription.findUnique({
      where: { businessId },
      select: { tier: true, status: true, stripeSubscriptionId: true },
    });
    const liveSubscriptionId =
      current?.stripeSubscriptionId &&
      (current.status === 'active' || current.status === 'past_due')
        ? current.stripeSubscriptionId
        : null;

    if (tier === 'free') {
      if (liveSubscriptionId) {
        await this.provider.cancelSubscription(liveSubscriptionId);
        await this.events.record({
          businessId,
          actorId: ownerId,
          type: 'subscription_canceled',
          tier: current?.tier ?? null,
        });
      }

      await this.prisma.businessSubscription.upsert({
        where: { businessId },
        create: { businessId, tier: 'free', status: 'active' },
        update: {
          tier: 'free',
          status: 'active',
          stripeSubscriptionId: null,
          stripePriceId: null,
          currentPeriodEnd: null,
        },
      });
      await this.events.record({
        businessId,
        actorId: ownerId,
        type: 'free_selected',
        tier: 'free',
      });

      return { status: { tier: 'free', status: 'active', isGateOpen: true } };
    }

    if (!this.provider.isConfigured()) {
      throw new ServiceUnavailableException('Оплата подписки временно недоступна');
    }

    if (liveSubscriptionId) {
      const snapshot = await this.provider.updateSubscriptionPrice(liveSubscriptionId, tier);
      await this.prisma.businessSubscription.update({
        where: { businessId },
        data: {
          tier,
          status: snapshot.status,
          stripePriceId: snapshot.stripePriceId,
          currentPeriodEnd: snapshot.currentPeriodEnd,
        },
      });
      await this.events.record({
        businessId,
        actorId: ownerId,
        type: 'subscription_updated',
        tier,
        metadata: { fromTier: current?.tier ?? null },
      });

      return {
        status: { tier, status: snapshot.status, isGateOpen: snapshot.status !== 'canceled' },
      };
    }

    const { url } = await this.provider.createCheckoutSession({
      businessId,
      ownerId,
      tier,
      successUrl: `${this.frontendUrl}/business/${businessId}/plan?checkout=success`,
      cancelUrl: `${this.frontendUrl}/business/${businessId}/plan?checkout=cancel`,
    });

    // Выставляем `incomplete` ДО возврата URL — если владелец вернётся на
    // `/plan`, не завершив оплату, гейт по-прежнему покажет "в процессе",
    // а не заново предложит выбор (см. `BillingStatusDto.isGateOpen`).
    await this.prisma.businessSubscription.upsert({
      where: { businessId },
      create: { businessId, tier, status: 'incomplete' },
      update: { tier, status: 'incomplete' },
    });
    await this.events.record({ businessId, actorId: ownerId, type: 'checkout_started', tier });

    return { status: { tier, status: 'incomplete', isGateOpen: false }, checkoutUrl: url };
  }

  /** Только логирует событие — НИКОГДА не трогает `BusinessSubscription`,
   * Enterprise не проходит через self-serve чекаут и не открывает гейт
   * конструктора сам по себе (нужен отдельный выбранный тариф). */
  async recordEnterpriseInquiry(businessId: string, ownerId: string): Promise<void> {
    await this.assertOwnership(businessId, ownerId);
    await this.events.record({
      businessId,
      actorId: ownerId,
      type: 'enterprise_inquiry',
      tier: 'enterprise',
    });
  }

  async listHistory(businessId: string, ownerId: string): Promise<PlanEventDto[]> {
    await this.assertOwnership(businessId, ownerId);
    return this.events.listForBusiness(businessId);
  }

  /** `checkout.session.completed` — Checkout Session сама не несёт
   * Price/`current_period_end` без `expand`, поэтому обогащаем через
   * отдельный вызов Stripe (`getSubscriptionSnapshot`, только у
   * `StripeSubscriptionAdapter`, не в общей абстракции — единственный
   * потребитель этого метода). */
  async handleCheckoutCompleted(input: {
    businessId: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  }): Promise<void> {
    if (!input.stripeSubscriptionId) return;

    const snapshot = await this.provider.getSubscriptionSnapshot(input.stripeSubscriptionId);

    await this.prisma.businessSubscription.updateMany({
      where: { businessId: input.businessId },
      data: {
        status: snapshot?.status ?? 'active',
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripePriceId: snapshot?.stripePriceId ?? null,
        currentPeriodEnd: snapshot?.currentPeriodEnd ?? null,
      },
    });
    await this.events.record({
      businessId: input.businessId,
      actorId: null,
      type: 'checkout_completed',
      tier: null,
      metadata: { stripeSubscriptionId: input.stripeSubscriptionId },
    });
  }

  async handleSubscriptionUpdated(input: {
    businessId: string;
    status: 'active' | 'past_due' | 'canceled';
    stripePriceId: string | null;
    currentPeriodEnd: Date | null;
  }): Promise<void> {
    await this.prisma.businessSubscription.updateMany({
      where: { businessId: input.businessId },
      data: {
        status: input.status,
        stripePriceId: input.stripePriceId,
        currentPeriodEnd: input.currentPeriodEnd,
      },
    });
    await this.events.record({
      businessId: input.businessId,
      actorId: null,
      type: 'subscription_updated',
      tier: null,
      metadata: { status: input.status },
    });
  }

  async handleSubscriptionDeleted(businessId: string): Promise<void> {
    await this.prisma.businessSubscription.updateMany({
      where: { businessId },
      data: { status: 'canceled' },
    });
    await this.events.record({
      businessId,
      actorId: null,
      type: 'subscription_canceled',
      tier: null,
    });
  }

  private async assertOwnership(businessId: string, ownerId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
  }
}
