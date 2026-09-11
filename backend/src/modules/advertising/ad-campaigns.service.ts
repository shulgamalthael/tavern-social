import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AdCampaign, AdCreative } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { MediaAssetsService } from '@/modules/media-assets/media-assets.service';
import { PaymentAmountTooLowError } from '@/modules/payments/payments.types';
import { PaymentProvider } from '@/modules/payments/payment-provider';
import type { AddAdCreativeDto } from './dto/add-ad-creative.dto';
import type { CreateAdCampaignDto } from './dto/create-ad-campaign.dto';
import {
  toAdCampaignDto,
  toAdCreativeDto,
  type AdCampaignDto,
  type AdCreativeDto,
} from './advertising.types';

type CampaignWithCreatives = AdCampaign & { creatives: AdCreative[] };

/**
 * Self-service self-serve кампании (согласовано с владельцем — «Self-service
 * для любого Business», НЕ admin-only) — тот же owner-scoped паттерн, что
 * `CustomWidgetsService`/`OrdersService`: `assertOwnership` на каждый
 * владелец-вызов, `findOwnedCampaign` для операций над конкретной кампанией.
 *
 * Оплата — ТРЕТИЙ вызывающий уже существующего `PaymentProvider`
 * (`createPaymentIntent`/`verifyWebhookSignature`), рядом с `Order` и
 * `Appointment` — ни одной новой строчки интеграции со Stripe, см. корневой
 * план фичи §3. В отличие от `Order` (честный заказ без оплаты — валидный
 * промежуточный статус, продавец обрабатывает вручную), кампания без оплаты
 * не имеет смысла продолжать — поэтому `submitForReview` бросает, если
 * `PaymentProvider` не настроен или платёж не удался, а не тихо
 * деградирует.
 */
@Injectable()
export class AdCampaignsService {
  private readonly logger = new Logger(AdCampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProvider: PaymentProvider,
    private readonly mediaAssetsService: MediaAssetsService,
  ) {}

  async list(businessId: string, ownerId: string): Promise<AdCampaignDto[]> {
    await this.assertOwnership(businessId, ownerId);
    const campaigns = await this.prisma.adCampaign.findMany({
      where: { advertiserBusinessId: businessId },
      include: { creatives: true },
      orderBy: { createdAt: 'desc' },
    });
    return campaigns.map((campaign) => toAdCampaignDto(campaign));
  }

  async get(businessId: string, campaignId: string, ownerId: string): Promise<AdCampaignDto> {
    await this.assertOwnership(businessId, ownerId);
    const campaign = await this.findOwnedCampaign(businessId, campaignId);
    return toAdCampaignDto(campaign);
  }

  async create(
    businessId: string,
    ownerId: string,
    dto: CreateAdCampaignDto,
  ): Promise<AdCampaignDto> {
    const business = await this.assertOwnership(businessId, ownerId);
    await this.assertNotBannedAdvertiser(businessId);

    const campaign = await this.prisma.adCampaign.create({
      data: {
        advertiserBusinessId: businessId,
        name: dto.name,
        budgetCents: dto.budgetCents,
        currency: business.currency,
        billingModel: dto.billingModel,
        bidCents: dto.bidCents,
        targetCategories: dto.targetCategories ?? [],
        targetPlacements: dto.targetPlacements,
        targetDevices: dto.targetDevices ?? [],
        targetLocales: dto.targetLocales ?? [],
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      include: { creatives: true },
    });
    return toAdCampaignDto(campaign);
  }

  /** Ограничено статусом `draft` — после отправки на модерацию (`submitFor
   * Review`) креативы кампании больше не редактируются здесь: реальный
   * бюджет уже списывается на согласованное содержимое, произвольная
   * подмена креатива постфактум была бы способом обойти модерацию. */
  async addCreative(
    businessId: string,
    campaignId: string,
    ownerId: string,
    dto: AddAdCreativeDto,
  ): Promise<AdCampaignDto> {
    await this.assertOwnership(businessId, ownerId);
    const campaign = await this.findOwnedCampaign(businessId, campaignId);
    if (campaign.status !== 'draft') {
      throw new BadRequestException(
        'Добавлять креативы можно только к кампании в статусе "черновик"',
      );
    }

    if (dto.format === 'video' && !dto.videoUrl) {
      throw new BadRequestException('Формат "video" требует videoUrl');
    }
    if (dto.format !== 'video' && dto.videoUrl) {
      throw new BadRequestException('videoUrl допустим только для формата "video"');
    }

    if (dto.imageUrl || dto.videoUrl) {
      const ownedAssets = await this.mediaAssetsService.list(businessId, ownerId);
      const ownedUrls = new Set(ownedAssets.map((asset) => asset.url));
      if (dto.imageUrl && !ownedUrls.has(dto.imageUrl)) {
        throw new BadRequestException(
          'imageUrl должен быть файлом, уже загруженным для этого бизнеса',
        );
      }
      if (dto.videoUrl && !ownedUrls.has(dto.videoUrl)) {
        throw new BadRequestException(
          'videoUrl должен быть файлом, уже загруженным для этого бизнеса',
        );
      }
    }

    await this.prisma.adCreative.create({
      data: {
        campaignId,
        format: dto.format,
        headline: dto.headline,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        videoUrl: dto.videoUrl ?? null,
        ctaLabel: dto.ctaLabel ?? null,
        targetUrl: dto.targetUrl,
      },
    });

    const updated = await this.findOwnedCampaign(businessId, campaignId);
    return toAdCampaignDto(updated);
  }

  async removeCreative(
    businessId: string,
    campaignId: string,
    creativeId: string,
    ownerId: string,
  ): Promise<AdCampaignDto> {
    await this.assertOwnership(businessId, ownerId);
    const campaign = await this.findOwnedCampaign(businessId, campaignId);
    if (campaign.status !== 'draft') {
      throw new BadRequestException('Удалять креативы можно только из черновика');
    }
    const creative = campaign.creatives.find((item) => item.id === creativeId);
    if (!creative) throw new NotFoundException('Креатив не найден');

    await this.prisma.adCreative.delete({ where: { id: creativeId } });
    const updated = await this.findOwnedCampaign(businessId, campaignId);
    return toAdCampaignDto(updated);
  }

  /** Создаёт `PaymentIntent` на весь `budgetCents` кампании (см. `Payment
   * Provider.createPaymentIntent`, тот же вызов, что `OrdersService.
   * createFromCart`) и переводит кампанию в `pending_review` — оплата не
   * равна одобрению, см. `markPaidByPaymentIntent`/`approve` ниже: платёж
   * подтверждает готовность рекламодателя платить, модерация — что
   * содержимое допустимо к показу. */
  async submitForReview(
    businessId: string,
    campaignId: string,
    ownerId: string,
  ): Promise<AdCampaignDto> {
    await this.assertOwnership(businessId, ownerId);
    await this.assertNotBannedAdvertiser(businessId);
    const campaign = await this.findOwnedCampaign(businessId, campaignId);
    if (campaign.status !== 'draft') {
      throw new BadRequestException('Кампания уже отправлена на модерацию или обработана');
    }
    if (campaign.creatives.length === 0) {
      throw new BadRequestException('Добавьте хотя бы один креатив перед отправкой на модерацию');
    }
    if (!this.paymentProvider.isConfigured()) {
      throw new BadRequestException('Приём оплаты временно недоступен, попробуйте позже');
    }

    let paymentIntentId: string;
    let clientSecret: string;
    try {
      const result = await this.paymentProvider.createPaymentIntent({
        amountCents: campaign.budgetCents,
        currency: campaign.currency,
        metadata: { campaignId: campaign.id, businessId },
      });
      paymentIntentId = result.paymentIntentId;
      clientSecret = result.clientSecret;
    } catch (error) {
      const message =
        error instanceof PaymentAmountTooLowError
          ? 'Бюджет кампании слишком мал для оплаты'
          : 'Не удалось создать платёж — попробуйте позже';
      this.logger.error(
        `Не удалось создать PaymentIntent для кампании ${campaign.id}: ${(error as Error).message}`,
      );
      throw new BadRequestException(message);
    }

    const updated = await this.prisma.adCampaign.update({
      where: { id: campaign.id },
      data: { status: 'pending_review', stripePaymentIntentId: paymentIntentId },
      include: { creatives: true },
    });
    return toAdCampaignDto(updated, clientSecret);
  }

  /** Вызывается только вебхуком Stripe (`StripeWebhookController`) — не
   * owner-CRUD путь, тот же принцип, что `OrdersService.
   * markPaidByPaymentIntent`. НЕ активирует кампанию — статус остаётся
   * `pending_review` до ручного решения администратора (`approve`/
   * `reject` ниже), оплата и модерация — независимые условия. */
  async markPaidByPaymentIntent(paymentIntentId: string): Promise<void> {
    const campaign = await this.prisma.adCampaign.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (!campaign) {
      this.logger.warn(`Вебхук Stripe для неизвестной рекламной кампании ${paymentIntentId}`);
      return;
    }
    await this.prisma.adCampaign.update({
      where: { id: campaign.id },
      data: { paymentStatus: 'paid' },
    });
  }

  /** Реальное списание уже оплаченного `budgetCents` (см. `AdBillingModel`'s
   * комментарий) — вызывается из `PublicSitesController.recordAdImpression`
   * рядом с (не вместо) записью в `AnalyticsEvent`, fire-and-forget, не
   * должен уронить сам показ посетителю при сбое (тот же принцип, что и у
   * `AnalyticsService.record`).
   *
   * `impressionsServed` инкрементируется ВСЕГДА (нужен для честной
   * CTR-статистики независимо от модели биллинга) — но `spentCents`
   * пересчитывается из него заново только для `billingModel: 'cpm'`;
   * `cpc`-кампания получает бесплатные показы, платит только за клик (см.
   * `recordClick`), стандартное для рекламных сетей разделение.
   *
   * Не атомарно одним запросом (инкремент + пересчёт `spentCents` — два
   * отдельных `UPDATE`) — при очень высокой одновременной нагрузке на один
   * и тот же креатив возможен небольшой снос (redundant recompute), не
   * потеря данных: `impressionsServed` всё равно инкрементируется атомарно
   * на уровне Postgres, а `spentCents` — идемпотентный пересчёт от него же,
   * не независимый счётчик. Тот же уровень честного упрощения, что и
   * `AdEngineService`'s round-robin-тайбрейк — не скрыто, названо в
   * документации фичи.
   *
   * `campaignId` приходит из тела анонимного `POST .../ads/impression` —
   * untrusted input (см. `RecordAdEventDto`, проверяет только "непустая
   * строка", не "существующая кампания"). Обёрнуто целиком в try/catch —
   * несуществующий/чужой id не должен превращаться в 500 у анонимного
   * посетителя, тот же принцип, что и `AnalyticsService.record`. */
  async recordImpression(campaignId: string): Promise<void> {
    try {
      const campaign = await this.prisma.adCampaign.update({
        where: { id: campaignId },
        data: { impressionsServed: { increment: 1 } },
      });
      if (campaign.billingModel !== 'cpm') return;
      await this.applySpend(
        campaign,
        Math.floor((campaign.impressionsServed * campaign.bidCents) / 1000),
      );
    } catch (error) {
      this.logger.warn(
        `Не удалось учесть показ рекламы для кампании ${campaignId}: ${(error as Error).message}`,
      );
    }
  }

  async recordClick(campaignId: string): Promise<void> {
    try {
      const campaign = await this.prisma.adCampaign.update({
        where: { id: campaignId },
        data: { clicksServed: { increment: 1 } },
      });
      if (campaign.billingModel !== 'cpc') return;
      await this.applySpend(campaign, campaign.clicksServed * campaign.bidCents);
    } catch (error) {
      this.logger.warn(
        `Не удалось учесть клик по рекламе для кампании ${campaignId}: ${(error as Error).message}`,
      );
    }
  }

  /** Общий хвост `recordImpression`/`recordClick` — пересчитывает
   * `spentCents` и автоматически ставит кампанию на паузу при исчерпании
   * бюджета (`spentCents >= budgetCents`), реальная, а не декларативная
   * авто-пауза: `AdEngineService` отбирает только `status: 'active'`,
   * поставленная на паузу кампания перестаёт получать показы со следующего
   * же запроса, без отдельного фонового джоба. */
  private async applySpend(campaign: AdCampaign, nextSpentCents: number): Promise<void> {
    if (nextSpentCents === campaign.spentCents) return;
    await this.prisma.adCampaign.update({
      where: { id: campaign.id },
      data: {
        spentCents: nextSpentCents,
        ...(nextSpentCents >= campaign.budgetCents && campaign.status === 'active'
          ? { status: 'paused' }
          : {}),
      },
    });
  }

  // --- Admin-only (см. AdminAdvertisingController) -----------------------

  async listPendingReview(): Promise<AdCampaignDto[]> {
    const campaigns = await this.prisma.adCampaign.findMany({
      where: { status: 'pending_review' },
      include: { creatives: true },
      orderBy: { createdAt: 'asc' },
    });
    return campaigns.map((campaign) => toAdCampaignDto(campaign));
  }

  /** Уже одобренные кампании — единственное место, откуда админ может дойти
   * до per-creative модерации (`rejectCreative`/`approveCreative` ниже):
   * снять один креатив имеет смысл только у кампании, которая уже реально
   * показывается. */
  async listActive(): Promise<AdCampaignDto[]> {
    const campaigns = await this.prisma.adCampaign.findMany({
      where: { status: 'active' },
      include: { creatives: true },
      orderBy: { createdAt: 'desc' },
    });
    return campaigns.map((campaign) => toAdCampaignDto(campaign));
  }

  /** `status: 'paused'` — сегодня попадают сюда ТОЛЬКО автоматически, при
   * исчерпании бюджета (см. `applySpend`), ручной паузы админом в этом
   * слайсе нет. Без этого списка исчерпавшая бюджет кампания стала бы
   * невидимой для админа — не в очереди модерации, не среди активных.
   * Read-only здесь (без approve/reject) — единственное осмысленное
   * действие, "продлить бюджет", в этом слайсе не реализовано. */
  async listPaused(): Promise<AdCampaignDto[]> {
    const campaigns = await this.prisma.adCampaign.findMany({
      where: { status: 'paused' },
      include: { creatives: true },
      orderBy: { updatedAt: 'desc' },
    });
    return campaigns.map((campaign) => toAdCampaignDto(campaign));
  }

  async approve(campaignId: string): Promise<AdCampaignDto> {
    const campaign = await this.findAnyCampaign(campaignId);
    if (campaign.paymentStatus !== 'paid') {
      throw new BadRequestException('Кампания ещё не оплачена — одобрение недоступно');
    }
    const updated = await this.prisma.adCampaign.update({
      where: { id: campaignId },
      data: { status: 'active', rejectionReason: null },
      include: { creatives: true },
    });
    return toAdCampaignDto(updated);
  }

  /** Отклонённая кампания никогда не будет показана — деньги за неё
   * рекламодателя нельзя молча оставлять платформе (тот же принцип, что и
   * `OrdersService.refund`, тот же вызов `PaymentProvider.refundPayment`).
   * Возврат — только если реально было чем возвращать (`paymentStatus:
   * 'paid'` и есть `stripePaymentIntentId`); черновик/неоплаченная кампания
   * просто помечается отклонённой без похода в Stripe. */
  async reject(campaignId: string, reason?: string): Promise<AdCampaignDto> {
    const campaign = await this.findAnyCampaign(campaignId);

    if (campaign.paymentStatus === 'paid' && campaign.stripePaymentIntentId) {
      try {
        await this.paymentProvider.refundPayment(campaign.stripePaymentIntentId);
      } catch (error) {
        this.logger.error(
          `Не удалось вернуть оплату за отклонённую кампанию ${campaign.id}: ${(error as Error).message}`,
        );
        throw new BadRequestException(
          'Не удалось вернуть оплату рекламодателю — кампания не отклонена, попробуйте позже',
        );
      }
    }

    const updated = await this.prisma.adCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'rejected',
        rejectionReason: reason ?? null,
        ...(campaign.paymentStatus === 'paid' ? { paymentStatus: 'refunded' } : {}),
      },
      include: { creatives: true },
    });
    return toAdCampaignDto(updated);
  }

  /** Тонкая модерация ПОВЕРХ модерации кампании (см. `AdCreativeStatus`'s
   * комментарий в schema.prisma) — снимает ОДИН креатив с показа, не трогая
   * `AdCampaign.status` и остальные креативы той же кампании. */
  async rejectCreative(creativeId: string, reason?: string): Promise<AdCreativeDto> {
    const creative = await this.findAnyCreative(creativeId);
    const updated = await this.prisma.adCreative.update({
      where: { id: creative.id },
      data: { status: 'rejected', rejectionReason: reason ?? null },
    });
    return toAdCreativeDto(updated);
  }

  async approveCreative(creativeId: string): Promise<AdCreativeDto> {
    const creative = await this.findAnyCreative(creativeId);
    const updated = await this.prisma.adCreative.update({
      where: { id: creative.id },
      data: { status: 'approved', rejectionReason: null },
    });
    return toAdCreativeDto(updated);
  }

  // --- Admin-only: banned advertisers (см. `AdvertiserBan`'s комментарий) --

  async banAdvertiser(businessId: string, reason?: string): Promise<void> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Бизнес не найден');

    await this.prisma.advertiserBan.upsert({
      where: { businessId },
      create: { businessId, reason: reason ?? null },
      update: { reason: reason ?? null, bannedAt: new Date() },
    });
  }

  async unbanAdvertiser(businessId: string): Promise<void> {
    await this.prisma.advertiserBan.deleteMany({ where: { businessId } });
  }

  async listBannedAdvertisers(): Promise<
    { businessId: string; businessName: string; reason: string | null; bannedAt: string }[]
  > {
    const bans = await this.prisma.advertiserBan.findMany({
      include: { business: { select: { name: true } } },
      orderBy: { bannedAt: 'desc' },
    });
    return bans.map((ban) => ({
      businessId: ban.businessId,
      businessName: ban.business.name,
      reason: ban.reason,
      bannedAt: ban.bannedAt.toISOString(),
    }));
  }

  /** Вызывается из `create`/`submitForReview` — банит именно РЕКЛАМОДАТЕЛЯ
   * (см. `AdvertiserBan`'s комментарий: не трогает роль паблишера того же
   * бизнеса). Сообщение намеренно не раскрывает `reason` вызывающему —
   * причина бана видна только администратору (`listBannedAdvertisers`), не
   * забаненному бизнесу через обычный API. */
  private async assertNotBannedAdvertiser(businessId: string): Promise<void> {
    const ban = await this.prisma.advertiserBan.findUnique({ where: { businessId } });
    if (ban) {
      throw new ForbiddenException(
        'Этому бизнесу запрещено создавать рекламные кампании — обратитесь в поддержку',
      );
    }
  }

  private async findAnyCreative(creativeId: string) {
    const creative = await this.prisma.adCreative.findUnique({ where: { id: creativeId } });
    if (!creative) throw new NotFoundException('Креатив не найден');
    return creative;
  }

  private async findAnyCampaign(campaignId: string): Promise<CampaignWithCreatives> {
    const campaign = await this.prisma.adCampaign.findUnique({
      where: { id: campaignId },
      include: { creatives: true },
    });
    if (!campaign) throw new NotFoundException('Кампания не найдена');
    return campaign;
  }

  private async findOwnedCampaign(
    businessId: string,
    campaignId: string,
  ): Promise<CampaignWithCreatives> {
    const campaign = await this.prisma.adCampaign.findFirst({
      where: { id: campaignId, advertiserBusinessId: businessId },
      include: { creatives: true },
    });
    if (!campaign) throw new NotFoundException('Кампания не найдена');
    return campaign;
  }

  /** Публичный (не `private`) — тот же приём, что `ProductsService.
   * assertOwnership`: `AdCampaignsController.uploadImage` вызывает его
   * до записи файла на диск, не дублируя проверку владения. */
  async assertOwnership(businessId: string, ownerId: string): Promise<{ currency: string }> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true, currency: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
    return { currency: business.currency };
  }
}
