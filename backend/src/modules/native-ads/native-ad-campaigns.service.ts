import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { NativeAdCampaign, NativeAdCreative, NativeAdRevenueEventType } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { MediaAssetsService } from '@/modules/media-assets/media-assets.service';
import { PaymentAmountTooLowError } from '@/modules/payments/payments.types';
import { PaymentProvider } from '@/modules/payments/payment-provider';
import type { AddNativeAdCreativeDto } from './dto/add-native-ad-creative.dto';
import type { CreateNativeAdCampaignDto } from './dto/create-native-ad-campaign.dto';
import { splitRevenue } from './lib/native-ad-revenue.lib';
import { NativeAdRevenueSettingsService } from './native-ad-revenue-settings.service';
import {
  toNativeAdCampaignDto,
  toNativeAdCreativeDto,
  type NativeAdCampaignDto,
  type NativeAdCreativeDto,
} from './native-ads.types';

type CampaignWithCreatives = NativeAdCampaign & { creatives: NativeAdCreative[] };

/**
 * Native Advertising — Creator Monetization Phase 2 (AI_PLATFORM_ROADMAP.md
 * §80). Прямое зеркало `AdCampaignsService` (`advertising` module) —
 * self-service для любого `Business`, оплата тем же `PaymentProvider`
 * (пятый вызывающий, рядом с Order/Appointment/AdCampaign/PostBoost),
 * `AdvertiserBan` — тот же compliance-примитив, что и у сайтовой рекламы
 * (платформенное понятие "забанен как рекламодатель", не привязанное к
 * конкретному движку). Модуль НЕ импортирует `advertising` — независимая
 * копия, та же причина, по которой сама модель не построена на `AdCampaign`
 * (см. `NativeAdCampaign`'s комментарий в schema.prisma).
 */
@Injectable()
export class NativeAdCampaignsService {
  private readonly logger = new Logger(NativeAdCampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProvider: PaymentProvider,
    private readonly mediaAssetsService: MediaAssetsService,
    private readonly revenueSettingsService: NativeAdRevenueSettingsService,
  ) {}

  async list(businessId: string, ownerId: string): Promise<NativeAdCampaignDto[]> {
    await this.assertOwnership(businessId, ownerId);
    const campaigns = await this.prisma.nativeAdCampaign.findMany({
      where: { advertiserBusinessId: businessId },
      include: { creatives: true },
      orderBy: { createdAt: 'desc' },
    });
    return campaigns.map((campaign) => toNativeAdCampaignDto(campaign));
  }

  async get(businessId: string, campaignId: string, ownerId: string): Promise<NativeAdCampaignDto> {
    await this.assertOwnership(businessId, ownerId);
    const campaign = await this.findOwnedCampaign(businessId, campaignId);
    return toNativeAdCampaignDto(campaign);
  }

  async create(
    businessId: string,
    ownerId: string,
    dto: CreateNativeAdCampaignDto,
  ): Promise<NativeAdCampaignDto> {
    const business = await this.assertOwnership(businessId, ownerId);
    await this.assertNotBannedAdvertiser(businessId);

    const campaign = await this.prisma.nativeAdCampaign.create({
      data: {
        advertiserBusinessId: businessId,
        name: dto.name,
        budgetCents: dto.budgetCents,
        currency: business.currency,
        billingModel: dto.billingModel,
        bidCents: dto.bidCents,
        targetCategoryIds: dto.targetCategoryIds ?? [],
        targetGeography: dto.targetGeography ?? [],
        adCategory: dto.adCategory ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      include: { creatives: true },
    });
    return toNativeAdCampaignDto(campaign);
  }

  /** Ограничено статусом `draft` — тот же принцип, что `AdCampaignsService.
   * addCreative`: после отправки на модерацию бюджет уже списывается на
   * согласованное содержимое. */
  async addCreative(
    businessId: string,
    campaignId: string,
    ownerId: string,
    dto: AddNativeAdCreativeDto,
  ): Promise<NativeAdCampaignDto> {
    await this.assertOwnership(businessId, ownerId);
    const campaign = await this.findOwnedCampaign(businessId, campaignId);
    if (campaign.status !== 'draft') {
      throw new BadRequestException(
        'Добавлять креативы можно только к кампании в статусе "черновик"',
      );
    }

    if (dto.style === 'video' && !dto.videoUrl) {
      throw new BadRequestException('Стиль "video" требует videoUrl');
    }
    if (dto.style !== 'video' && dto.videoUrl) {
      throw new BadRequestException('videoUrl допустим только для стиля "video"');
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

    await this.prisma.nativeAdCreative.create({
      data: {
        campaignId,
        style: dto.style,
        headline: dto.headline,
        bodyText: dto.bodyText ?? null,
        imageUrl: dto.imageUrl ?? null,
        videoUrl: dto.videoUrl ?? null,
        ctaLabel: dto.ctaLabel ?? null,
        targetUrl: dto.targetUrl,
      },
    });

    const updated = await this.findOwnedCampaign(businessId, campaignId);
    return toNativeAdCampaignDto(updated);
  }

  async removeCreative(
    businessId: string,
    campaignId: string,
    creativeId: string,
    ownerId: string,
  ): Promise<NativeAdCampaignDto> {
    await this.assertOwnership(businessId, ownerId);
    const campaign = await this.findOwnedCampaign(businessId, campaignId);
    if (campaign.status !== 'draft') {
      throw new BadRequestException('Удалять креативы можно только из черновика');
    }
    const creative = campaign.creatives.find((item) => item.id === creativeId);
    if (!creative) throw new NotFoundException('Креатив не найден');

    await this.prisma.nativeAdCreative.delete({ where: { id: creativeId } });
    const updated = await this.findOwnedCampaign(businessId, campaignId);
    return toNativeAdCampaignDto(updated);
  }

  /** Создаёт `PaymentIntent` на весь `budgetCents` (см.
   * `PaymentProvider.createPaymentIntent`) и переводит кампанию в
   * `pending_review` — оплата не равна одобрению, см.
   * `markPaidByPaymentIntent`/`approve` ниже. `metadata.nativeCampaignId` —
   * отдельный ключ от `campaignId` (сайтовая реклама), чтобы
   * `StripeWebhookController` мог однозначно различить владельца события. */
  async submitForReview(
    businessId: string,
    campaignId: string,
    ownerId: string,
  ): Promise<NativeAdCampaignDto> {
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
        metadata: { nativeCampaignId: campaign.id, businessId },
      });
      paymentIntentId = result.paymentIntentId;
      clientSecret = result.clientSecret;
    } catch (error) {
      const message =
        error instanceof PaymentAmountTooLowError
          ? 'Бюджет кампании слишком мал для оплаты'
          : 'Не удалось создать платёж — попробуйте позже';
      this.logger.error(
        `Не удалось создать PaymentIntent для native ad кампании ${campaign.id}: ${(error as Error).message}`,
      );
      throw new BadRequestException(message);
    }

    const updated = await this.prisma.nativeAdCampaign.update({
      where: { id: campaign.id },
      data: { status: 'pending_review', stripePaymentIntentId: paymentIntentId },
      include: { creatives: true },
    });
    return toNativeAdCampaignDto(updated, clientSecret);
  }

  /** Вызывается только вебхуком Stripe (`StripeWebhookController`) — не
   * активирует кампанию, см. `AdCampaignsService.markPaidByPaymentIntent`'s
   * комментарий, тот же принцип. */
  async markPaidByPaymentIntent(paymentIntentId: string): Promise<void> {
    const campaign = await this.prisma.nativeAdCampaign.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (!campaign) {
      this.logger.warn(`Вебхук Stripe для неизвестной native ad кампании ${paymentIntentId}`);
      return;
    }
    await this.prisma.nativeAdCampaign.update({
      where: { id: campaign.id },
      data: { paymentStatus: 'paid' },
    });
  }

  /** Тот же принцип, что `AdCampaignsService.recordImpression` — см. её
   * комментарий (инкремент всегда, пересчёт `spentCents` только для `cpm`,
   * не атомарно одним запросом, честно названное упрощение). Вызывается из
   * `NativeAdFeedController` рядом с фактической отдачей рекламы в ленте.
   * Принимает `assignmentId`, не `campaignId` (Phase 4, AI_PLATFORM_
   * ROADMAP.md §82) — без него `applySpendAndAttribute` не знал бы, какому
   * creator'у приписать событие в `NativeAdRevenueEvent`. */
  async recordImpression(assignmentId: string): Promise<void> {
    try {
      const assignment = await this.prisma.nativeAdAssignment.findUnique({
        where: { id: assignmentId },
        select: { campaignId: true, creatorProfileId: true },
      });
      if (!assignment) return;

      const campaign = await this.prisma.nativeAdCampaign.update({
        where: { id: assignment.campaignId },
        data: { impressionsServed: { increment: 1 } },
      });
      if (campaign.billingModel !== 'cpm') return;
      await this.applySpendAndAttribute(
        campaign,
        Math.floor((campaign.impressionsServed * campaign.bidCents) / 1000),
        assignmentId,
        assignment.creatorProfileId,
        'impression',
      );
    } catch (error) {
      this.logger.warn(
        `Не удалось учесть показ native ad для назначения ${assignmentId}: ${(error as Error).message}`,
      );
    }
  }

  async recordClick(assignmentId: string): Promise<void> {
    try {
      const assignment = await this.prisma.nativeAdAssignment.findUnique({
        where: { id: assignmentId },
        select: { campaignId: true, creatorProfileId: true },
      });
      if (!assignment) return;

      const campaign = await this.prisma.nativeAdCampaign.update({
        where: { id: assignment.campaignId },
        data: { clicksServed: { increment: 1 } },
      });
      if (campaign.billingModel !== 'cpc') return;
      await this.applySpendAndAttribute(
        campaign,
        campaign.clicksServed * campaign.bidCents,
        assignmentId,
        assignment.creatorProfileId,
        'click',
      );
    } catch (error) {
      this.logger.warn(
        `Не удалось учесть клик по native ad для назначения ${assignmentId}: ${(error as Error).message}`,
      );
    }
  }

  /** Дельта (`nextSpentCents - campaign.spentCents`, ДО перезаписи) — реальная
   * сумма, списанная ЗА ЭТО событие, не накопленный итог кампании. Именно
   * она делится между creator'ом/платформой/обработкой платежа
   * (`splitRevenue`) и записывается одной строкой `NativeAdRevenueEvent` —
   * ledger остаётся честным источником истины: сумма всех его
   * `grossCents` по кампании всегда равна её `spentCents`. Дельта часто
   * равна 0 для `cpm` (см. `splitRevenue`'s комментарий про округление до
   * целых центов — не каждый показ пересекает границу нового цента) — в
   * этом случае ни `spentCents`, ни ledger-строка не создаются, тот же
   * ранний `return`, что был здесь до атрибуции. */
  private async applySpendAndAttribute(
    campaign: NativeAdCampaign,
    nextSpentCents: number,
    assignmentId: string,
    creatorProfileId: string,
    type: NativeAdRevenueEventType,
  ): Promise<void> {
    const deltaCents = nextSpentCents - campaign.spentCents;
    if (deltaCents === 0) return;

    await this.prisma.nativeAdCampaign.update({
      where: { id: campaign.id },
      data: {
        spentCents: nextSpentCents,
        ...(nextSpentCents >= campaign.budgetCents && campaign.status === 'active'
          ? { status: 'paused' }
          : {}),
      },
    });

    const settings = await this.revenueSettingsService.get();
    const split = splitRevenue(deltaCents, settings);
    await this.prisma.nativeAdRevenueEvent.create({
      data: {
        campaignId: campaign.id,
        assignmentId,
        creatorProfileId,
        type,
        currency: campaign.currency,
        grossCents: deltaCents,
        creatorShareCents: split.creatorShareCents,
        platformFeeCents: split.platformFeeCents,
        processingFeeCents: split.processingFeeCents,
      },
    });
  }

  // --- Admin-only (см. AdminNativeAdsController) --------------------------

  async listPendingReview(): Promise<NativeAdCampaignDto[]> {
    const campaigns = await this.prisma.nativeAdCampaign.findMany({
      where: { status: 'pending_review' },
      include: { creatives: true },
      orderBy: { createdAt: 'asc' },
    });
    return campaigns.map((campaign) => toNativeAdCampaignDto(campaign));
  }

  async listActive(): Promise<NativeAdCampaignDto[]> {
    const campaigns = await this.prisma.nativeAdCampaign.findMany({
      where: { status: 'active' },
      include: { creatives: true },
      orderBy: { createdAt: 'desc' },
    });
    return campaigns.map((campaign) => toNativeAdCampaignDto(campaign));
  }

  async listPaused(): Promise<NativeAdCampaignDto[]> {
    const campaigns = await this.prisma.nativeAdCampaign.findMany({
      where: { status: 'paused' },
      include: { creatives: true },
      orderBy: { updatedAt: 'desc' },
    });
    return campaigns.map((campaign) => toNativeAdCampaignDto(campaign));
  }

  async approve(campaignId: string): Promise<NativeAdCampaignDto> {
    const campaign = await this.findAnyCampaign(campaignId);
    if (campaign.paymentStatus !== 'paid') {
      throw new BadRequestException('Кампания ещё не оплачена — одобрение недоступно');
    }
    const updated = await this.prisma.nativeAdCampaign.update({
      where: { id: campaignId },
      data: { status: 'active', rejectionReason: null },
      include: { creatives: true },
    });
    return toNativeAdCampaignDto(updated);
  }

  /** Тот же принцип возврата денег, что `AdCampaignsService.reject`. */
  async reject(campaignId: string, reason?: string): Promise<NativeAdCampaignDto> {
    const campaign = await this.findAnyCampaign(campaignId);

    if (campaign.paymentStatus === 'paid' && campaign.stripePaymentIntentId) {
      try {
        await this.paymentProvider.refundPayment(campaign.stripePaymentIntentId);
      } catch (error) {
        this.logger.error(
          `Не удалось вернуть оплату за отклонённую native ad кампанию ${campaign.id}: ${(error as Error).message}`,
        );
        throw new BadRequestException(
          'Не удалось вернуть оплату рекламодателю — кампания не отклонена, попробуйте позже',
        );
      }
    }

    const updated = await this.prisma.nativeAdCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'rejected',
        rejectionReason: reason ?? null,
        ...(campaign.paymentStatus === 'paid' ? { paymentStatus: 'refunded' } : {}),
      },
      include: { creatives: true },
    });
    return toNativeAdCampaignDto(updated);
  }

  async rejectCreative(creativeId: string, reason?: string): Promise<NativeAdCreativeDto> {
    const creative = await this.findAnyCreative(creativeId);
    const updated = await this.prisma.nativeAdCreative.update({
      where: { id: creative.id },
      data: { status: 'rejected', rejectionReason: reason ?? null },
    });
    return toNativeAdCreativeDto(updated);
  }

  async approveCreative(creativeId: string): Promise<NativeAdCreativeDto> {
    const creative = await this.findAnyCreative(creativeId);
    const updated = await this.prisma.nativeAdCreative.update({
      where: { id: creative.id },
      data: { status: 'approved', rejectionReason: null },
    });
    return toNativeAdCreativeDto(updated);
  }

  // --- Shared helpers ------------------------------------------------------

  /** Тот же `AdvertiserBan` (`advertising` module), не отдельная таблица —
   * см. `NativeAdCampaign`'s комментарий в schema.prisma: это платформенное
   * понятие, не привязанное к конкретному рекламному движку. Прямой Prisma-
   * запрос, а не импорт `AdCampaignsService`, — независимость модулей друг
   * от друга. */
  private async assertNotBannedAdvertiser(businessId: string): Promise<void> {
    const ban = await this.prisma.advertiserBan.findUnique({ where: { businessId } });
    if (ban) {
      throw new ForbiddenException(
        'Этому бизнесу запрещено создавать рекламные кампании — обратитесь в поддержку',
      );
    }
  }

  private async findAnyCreative(creativeId: string) {
    const creative = await this.prisma.nativeAdCreative.findUnique({ where: { id: creativeId } });
    if (!creative) throw new NotFoundException('Креатив не найден');
    return creative;
  }

  private async findAnyCampaign(campaignId: string): Promise<CampaignWithCreatives> {
    const campaign = await this.prisma.nativeAdCampaign.findUnique({
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
    const campaign = await this.prisma.nativeAdCampaign.findFirst({
      where: { id: campaignId, advertiserBusinessId: businessId },
      include: { creatives: true },
    });
    if (!campaign) throw new NotFoundException('Кампания не найдена');
    return campaign;
  }

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
