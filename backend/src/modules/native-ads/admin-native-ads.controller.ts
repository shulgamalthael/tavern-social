import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { NativeAdRevenueSettings } from '@prisma/client';
import { AdminGuard } from '@/common/guards/admin.guard';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AssignCreatorDto } from './dto/assign-creator.dto';
import { RejectNativeAdCampaignDto } from './dto/review-native-ad-campaign.dto';
import { UpdateNativeAdRevenueSettingsDto } from './dto/update-native-ad-revenue-settings.dto';
import {
  NativeAdAssignmentsService,
  type EligibleCreatorDto,
} from './native-ad-assignments.service';
import { NativeAdCampaignsService } from './native-ad-campaigns.service';
import { NativeAdPayoutsService } from './native-ad-payouts.service';
import { NativeAdRevenueSettingsService } from './native-ad-revenue-settings.service';
import type {
  AdminNativeAdPayoutDto,
  AdminNativeAdsOverviewDto,
  NativeAdAssignmentDto,
  NativeAdCampaignDto,
  NativeAdCreativeDto,
  RecommendedCreatorDto,
} from './native-ads.types';

/**
 * Admin Native Ads (Creator Monetization Phase 2, AI_PLATFORM_ROADMAP.md
 * §80) — тот же принцип "один составной overview", что
 * `AdminAdvertisingController`, но без 30-дневного графика (named scope
 * cut, см. `AdminNativeAdsOverviewDto`'s комментарий). Дополнительно —
 * ручное назначение creator'ов на кампанию (`assign`/`unassign`), которого
 * у сайтовой рекламы нет вообще: там показ решает `AdEngineService`
 * автоматически по таргетингу, здесь — по-прежнему руками, теперь с
 * ранжированной подсказкой (`recommended-creators`, Phase 3, см.
 * `NativeAdAssignmentsService.listRecommendedCreators`'s комментарий) поверх
 * той же таблицы `NativeAdAssignment`, не вместо ручного решения.
 */
@Controller('admin/native-ads')
@UseGuards(SessionAuthGuard, AdminGuard)
export class AdminNativeAdsController {
  constructor(
    private readonly campaignsService: NativeAdCampaignsService,
    private readonly assignmentsService: NativeAdAssignmentsService,
    private readonly revenueSettingsService: NativeAdRevenueSettingsService,
    private readonly payoutsService: NativeAdPayoutsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('overview')
  async getOverview(): Promise<AdminNativeAdsOverviewDto> {
    const [pendingCampaigns, activeCampaigns, pausedCampaigns, totals] = await Promise.all([
      this.campaignsService.listPendingReview(),
      this.campaignsService.listActive(),
      this.campaignsService.listPaused(),
      this.prisma.nativeAdCampaign.aggregate({
        _sum: { impressionsServed: true, clicksServed: true },
      }),
    ]);

    const revenueByCurrencyRows = await this.prisma.nativeAdCampaign.groupBy({
      by: ['currency'],
      where: { paymentStatus: 'paid' },
      _sum: { budgetCents: true },
    });
    const revenueByCurrency: Record<string, number> = {};
    for (const row of revenueByCurrencyRows) {
      revenueByCurrency[row.currency] = row._sum.budgetCents ?? 0;
    }

    // Реально РЕАЛИЗОВАННАЯ выручка (сумма ledger'а по показам/кликам) —
    // не то же самое, что `revenueByCurrency` выше (тот — весь ОПЛАЧЕННЫЙ
    // бюджет, включая ещё не потраченный). Разбивка по трём долям —
    // прозрачность для админа, тот же принцип, что и рекламодателю
    // (`NativeAdCampaignRevenueBreakdownDto`) и creator'у
    // (`CreatorRevenueSummaryDto`).
    const realizedByCurrencyRows = await this.prisma.nativeAdRevenueEvent.groupBy({
      by: ['currency'],
      _sum: { creatorShareCents: true, platformFeeCents: true, processingFeeCents: true },
    });
    const realizedRevenueByCurrency: AdminNativeAdsOverviewDto['totals']['realizedRevenueByCurrency'] =
      {};
    for (const row of realizedByCurrencyRows) {
      realizedRevenueByCurrency[row.currency] = {
        creatorShareCents: row._sum.creatorShareCents ?? 0,
        platformFeeCents: row._sum.platformFeeCents ?? 0,
        processingFeeCents: row._sum.processingFeeCents ?? 0,
      };
    }

    const impressions = totals._sum.impressionsServed ?? 0;
    const clicks = totals._sum.clicksServed ?? 0;

    return {
      pendingCampaigns,
      activeCampaigns,
      pausedCampaigns,
      totals: {
        impressions,
        clicks,
        ctr: impressions > 0 ? clicks / impressions : 0,
        revenueByCurrency,
        realizedRevenueByCurrency,
      },
    };
  }

  @Get('revenue-settings')
  getRevenueSettings(): Promise<NativeAdRevenueSettings> {
    return this.revenueSettingsService.get();
  }

  @Patch('revenue-settings')
  updateRevenueSettings(
    @Body() dto: UpdateNativeAdRevenueSettingsDto,
  ): Promise<NativeAdRevenueSettings> {
    return this.revenueSettingsService.update(dto);
  }

  @Get('eligible-creators')
  listEligibleCreators(): Promise<EligibleCreatorDto[]> {
    return this.assignmentsService.listEligibleCreators();
  }

  @Get('campaigns/:campaignId/assignments')
  listAssignments(@Param('campaignId') campaignId: string): Promise<NativeAdAssignmentDto[]> {
    return this.assignmentsService.listForCampaign(campaignId);
  }

  @Get('campaigns/:campaignId/recommended-creators')
  listRecommendedCreators(
    @Param('campaignId') campaignId: string,
  ): Promise<RecommendedCreatorDto[]> {
    return this.assignmentsService.listRecommendedCreators(campaignId);
  }

  @Post('campaigns/:campaignId/assign')
  assign(
    @Param('campaignId') campaignId: string,
    @Body() dto: AssignCreatorDto,
  ): Promise<NativeAdAssignmentDto> {
    return this.assignmentsService.assign(campaignId, dto.creatorProfileId);
  }

  @Delete('campaigns/:campaignId/assign/:creatorProfileId')
  unassign(
    @Param('campaignId') campaignId: string,
    @Param('creatorProfileId') creatorProfileId: string,
  ): Promise<void> {
    return this.assignmentsService.unassign(campaignId, creatorProfileId);
  }

  @Post('campaigns/:campaignId/approve')
  approve(@Param('campaignId') campaignId: string): Promise<NativeAdCampaignDto> {
    return this.campaignsService.approve(campaignId);
  }

  @Post('campaigns/:campaignId/reject')
  reject(
    @Param('campaignId') campaignId: string,
    @Body() dto: RejectNativeAdCampaignDto,
  ): Promise<NativeAdCampaignDto> {
    return this.campaignsService.reject(campaignId, dto.reason);
  }

  @Post('creatives/:creativeId/reject')
  rejectCreative(
    @Param('creativeId') creativeId: string,
    @Body() dto: RejectNativeAdCampaignDto,
  ): Promise<NativeAdCreativeDto> {
    return this.campaignsService.rejectCreative(creativeId, dto.reason);
  }

  @Post('creatives/:creativeId/approve')
  approveCreative(@Param('creativeId') creativeId: string): Promise<NativeAdCreativeDto> {
    return this.campaignsService.approveCreative(creativeId);
  }

  /** Очередь выплат, ожидающих реального перевода через Stripe Connect
   * (Phase 5) — см. `NativeAdPayoutsService`'s комментарий про
   * self-service-запрос + admin-подтверждение. */
  @Get('payouts')
  listPendingPayouts(): Promise<AdminNativeAdPayoutDto[]> {
    return this.payoutsService.listPending();
  }

  @Post('payouts/:payoutId/process')
  processPayout(@Param('payoutId') payoutId: string): Promise<AdminNativeAdPayoutDto> {
    return this.payoutsService.process(payoutId);
  }
}
