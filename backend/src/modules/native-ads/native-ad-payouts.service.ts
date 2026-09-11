import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { StripeConnectService } from '@/modules/creators/stripe-connect.service';
import { NativeAdRevenueSettingsService } from './native-ad-revenue-settings.service';
import {
  toNativeAdPayoutDto,
  type AdminNativeAdPayoutDto,
  type NativeAdPayoutDto,
} from './native-ads.types';

/**
 * Реальные выплаты creator'ам через Stripe Connect (Phase 5, AI_PLATFORM_
 * ROADMAP.md §83) — тот же принцип "self-service создание, admin-
 * подтверждение реального эффекта", что уже применён к `NativeAdCampaign`
 * (`draft/pending_review` → `active` только после `approve`): creator
 * ЗАПРАШИВАЕТ выплату (`status: pending`), реальный перевод денег происходит
 * только когда админ явно нажимает "обработать" (`process`) — самое тяжёлое,
 * необратимое действие во всей этой фиче не должно случаться автоматически
 * без человеческого решения.
 *
 * Зависит от `StripeConnectService` (`creators` module) — та же
 * однонаправленная связь между модулями, что уже есть у `OrdersModule`
 * (импортирует `AdvertisingModule`/`PostsModule` за их сервисами для
 * диспетчеризации вебхука): здесь `native-ads` module тянет РЕАЛЬНУЮ Stripe-
 * логику из `creators` module, а не дублирует её — но по-прежнему читает
 * данные `CreatorProfile` напрямую через Prisma (не через `CreatorsService`)
 * везде, где нужна только выборка, тот же принцип независимости модулей по
 * ДАННЫМ, что и раньше.
 */
@Injectable()
export class NativeAdPayoutsService {
  private readonly logger = new Logger(NativeAdPayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeConnectService: StripeConnectService,
    private readonly revenueSettingsService: NativeAdRevenueSettingsService,
  ) {}

  /** Creator Studio → «Доход» → «Запросить выплату». Берёт ВСЕ ещё не
   * учтённые ни в одной выплате события (`payoutId: null`) этой валюты,
   * создаёт `NativeAdPayout` и сразу помечает эти события её id — баланс,
   * доступный для СЛЕДУЮЩЕГО запроса, немедленно уменьшается на эту сумму,
   * не дожидаясь реального перевода (см. `process`'s комментарий про откат
   * при неудаче). */
  async requestPayout(userId: string, currency: string): Promise<NativeAdPayoutDto> {
    const creator = await this.prisma.creatorProfile.findUnique({ where: { userId } });
    if (!creator) throw new NotFoundException('Профиль Creator не найден');
    if (creator.stripeConnectStatus !== 'active') {
      throw new BadRequestException('Подключите выплаты через Stripe, чтобы запросить выплату');
    }

    const settings = await this.revenueSettingsService.get();
    const unclaimedEvents = await this.prisma.nativeAdRevenueEvent.findMany({
      where: { creatorProfileId: creator.id, currency, payoutId: null },
      select: { id: true, creatorShareCents: true },
    });

    const amountCents = unclaimedEvents.reduce((sum, event) => sum + event.creatorShareCents, 0);
    if (unclaimedEvents.length === 0 || amountCents < settings.minimumPayoutCents) {
      throw new BadRequestException(
        `Минимальная сумма выплаты — ${(settings.minimumPayoutCents / 100).toFixed(2)} ${currency}`,
      );
    }

    const payout = await this.prisma.nativeAdPayout.create({
      data: { creatorProfileId: creator.id, amountCents, currency, status: 'pending' },
    });
    await this.prisma.nativeAdRevenueEvent.updateMany({
      where: { id: { in: unclaimedEvents.map((event) => event.id) } },
      data: { payoutId: payout.id },
    });

    return toNativeAdPayoutDto(payout);
  }

  async listMyPayouts(userId: string): Promise<NativeAdPayoutDto[]> {
    const creator = await this.prisma.creatorProfile.findUnique({ where: { userId } });
    if (!creator) return [];

    const payouts = await this.prisma.nativeAdPayout.findMany({
      where: { creatorProfileId: creator.id },
      orderBy: { createdAt: 'desc' },
    });
    return payouts.map(toNativeAdPayoutDto);
  }

  // --- Admin-only ----------------------------------------------------------

  async listPending(): Promise<AdminNativeAdPayoutDto[]> {
    const payouts = await this.prisma.nativeAdPayout.findMany({
      where: { status: 'pending' },
      include: { creatorProfile: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    return payouts.map((payout) => ({
      ...toNativeAdPayoutDto(payout),
      creatorProfileId: payout.creatorProfileId,
      creatorName: payout.creatorProfile.user.name,
    }));
  }

  /** Реальный перевод денег — необратимое, самое чувствительное действие
   * этой фичи, только по явному решению администратора. Неудача Stripe
   * (например, capability ещё не включена) переводит выплату в `failed` и
   * ОСВОБОЖДАЕТ учтённые ею события обратно (`payoutId: null`) — тот же
   * принцип "деньги не должны потеряться молча", что и у остального
   * ledger'а: creator не теряет доступ к своему балансу из-за сбоя Stripe,
   * может запросить выплату повторно после починки проблемы (например,
   * завершив онбординг). */
  async process(payoutId: string): Promise<AdminNativeAdPayoutDto> {
    const payout = await this.prisma.nativeAdPayout.findUnique({
      where: { id: payoutId },
      include: { creatorProfile: { include: { user: { select: { name: true } } } } },
    });
    if (!payout) throw new NotFoundException('Выплата не найдена');
    if (payout.status !== 'pending') {
      throw new BadRequestException('Эта выплата уже обработана');
    }
    if (!payout.creatorProfile.stripeConnectedAccountId) {
      throw new BadRequestException("У creator'а не подключён Stripe Connect");
    }

    try {
      const { transferId } = await this.stripeConnectService.createTransfer(
        payout.creatorProfile.stripeConnectedAccountId,
        payout.amountCents,
        payout.currency,
      );
      const updated = await this.prisma.nativeAdPayout.update({
        where: { id: payoutId },
        data: { status: 'paid', stripeTransferId: transferId, paidAt: new Date() },
      });
      return {
        ...toNativeAdPayoutDto(updated),
        creatorProfileId: payout.creatorProfileId,
        creatorName: payout.creatorProfile.user.name,
      };
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : 'Неизвестная ошибка Stripe';
      this.logger.warn(`Не удалось выполнить выплату ${payoutId}: ${failureReason}`);

      const updated = await this.prisma.nativeAdPayout.update({
        where: { id: payoutId },
        data: { status: 'failed', failureReason },
      });
      await this.prisma.nativeAdRevenueEvent.updateMany({
        where: { payoutId },
        data: { payoutId: null },
      });
      return {
        ...toNativeAdPayoutDto(updated),
        creatorProfileId: payout.creatorProfileId,
        creatorName: payout.creatorProfile.user.name,
      };
    }
  }
}
