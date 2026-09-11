import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { NativeAdCampaignsService } from './native-ad-campaigns.service';
import type {
  CreatorRevenueSummaryDto,
  NativeAdCampaignRevenueBreakdownDto,
} from './native-ads.types';

/**
 * Отчётность поверх ledger'а (Creator Monetization Phase 4, AI_PLATFORM_
 * ROADMAP.md §82) — сам ledger (`NativeAdRevenueEvent`) пишется в
 * `NativeAdCampaignsService.recordImpression/recordClick`, этот сервис
 * только ЧИТАЕТ его агрегациями, ничего не пишет.
 */
@Injectable()
export class NativeAdRevenueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignsService: NativeAdCampaignsService,
  ) {}

  /** Creator Studio → «Доход» — по `userId` из сессии, не по
   * `creatorProfileId` (тот же принцип, что `NativeAdAssignmentsService.
   * listForCreatorUser`). Пусто, если у пользователя ещё нет `CreatorProfile`
   * — не ошибка. */
  async getMyRevenue(userId: string): Promise<CreatorRevenueSummaryDto> {
    const creator = await this.prisma.creatorProfile.findUnique({ where: { userId } });
    if (!creator) return { byCurrency: [] };

    const [grouped, unclaimedRows] = await Promise.all([
      this.prisma.nativeAdRevenueEvent.groupBy({
        by: ['currency', 'type'],
        where: { creatorProfileId: creator.id },
        _sum: { creatorShareCents: true },
        _count: true,
      }),
      // Незакрытый выплатой остаток (Phase 5) — `earnedCents` ниже
      // ПОЖИЗНЕННЫЙ итог (включая уже выплаченное), а этот — реально
      // доступный для НОВОГО запроса баланс, см. `NativeAdPayoutsService.
      // requestPayout`'s комментарий.
      this.prisma.nativeAdRevenueEvent.groupBy({
        by: ['currency'],
        where: { creatorProfileId: creator.id, payoutId: null },
        _sum: { creatorShareCents: true },
      }),
    ]);

    const availableByCurrency = new Map(
      unclaimedRows.map((row) => [row.currency, row._sum.creatorShareCents ?? 0]),
    );

    const byCurrencyMap = new Map<
      string,
      { earnedCents: number; impressions: number; clicks: number }
    >();
    for (const row of grouped) {
      const existing = byCurrencyMap.get(row.currency) ?? {
        earnedCents: 0,
        impressions: 0,
        clicks: 0,
      };
      existing.earnedCents += row._sum.creatorShareCents ?? 0;
      if (row.type === 'impression') existing.impressions += row._count;
      else existing.clicks += row._count;
      byCurrencyMap.set(row.currency, existing);
    }

    return {
      byCurrency: Array.from(byCurrencyMap.entries()).map(([currency, totals]) => ({
        currency,
        ...totals,
        availableCents: availableByCurrency.get(currency) ?? 0,
      })),
    };
  }

  /** Рекламодатель-facing прозрачность — куда реально уходит бюджет ОДНОЙ
   * кампании. Владение проверяется тем же `assertOwnership`, что и весь
   * остальной self-service CRUD кампаний (`NativeAdCampaignsController`),
   * не дублируется здесь заново. */
  async getCampaignBreakdown(
    businessId: string,
    campaignId: string,
    ownerId: string,
  ): Promise<NativeAdCampaignRevenueBreakdownDto> {
    await this.campaignsService.assertOwnership(businessId, ownerId);

    const campaign = await this.prisma.nativeAdCampaign.findFirst({
      where: { id: campaignId, advertiserBusinessId: businessId },
      select: { currency: true },
    });
    if (!campaign) {
      return {
        currency: 'USD',
        grossCents: 0,
        creatorShareCents: 0,
        platformFeeCents: 0,
        processingFeeCents: 0,
        impressions: 0,
        clicks: 0,
      };
    }

    const [totals, byType] = await Promise.all([
      this.prisma.nativeAdRevenueEvent.aggregate({
        where: { campaignId },
        _sum: {
          grossCents: true,
          creatorShareCents: true,
          platformFeeCents: true,
          processingFeeCents: true,
        },
      }),
      this.prisma.nativeAdRevenueEvent.groupBy({
        by: ['type'],
        where: { campaignId },
        _count: true,
      }),
    ]);

    return {
      currency: campaign.currency,
      grossCents: totals._sum.grossCents ?? 0,
      creatorShareCents: totals._sum.creatorShareCents ?? 0,
      platformFeeCents: totals._sum.platformFeeCents ?? 0,
      processingFeeCents: totals._sum.processingFeeCents ?? 0,
      impressions: byType.find((row) => row.type === 'impression')?._count ?? 0,
      clicks: byType.find((row) => row.type === 'click')?._count ?? 0,
    };
  }
}
