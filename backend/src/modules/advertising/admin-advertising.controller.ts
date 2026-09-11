import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AdminGuard } from '@/common/guards/admin.guard';
import { bucketByDay } from '@/modules/admin/lib/bucket-by-day';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import { AdvertisingInventoryService } from './advertising-inventory.service';
import { BanAdvertiserDto } from './dto/ban-advertiser.dto';
import { RejectAdCampaignDto } from './dto/review-ad-campaign.dto';
import type {
  AdCampaignDto,
  AdCreativeDto,
  AdminAdvertisingOverviewDto,
} from './advertising.types';
import { AdCampaignsService } from './ad-campaigns.service';

/**
 * Admin Advertising Dashboard — один составной `overview`, тот же принцип,
 * что и `AiInfrastructureController` (см. её комментарий): у рекламного
 * инвентаря сегодня нет отдельного объёма данных под 5+ разрозненных
 * экранов, дробить один экран на несколько запросов было бы искусственным
 * усложнением. `approve`/`reject` — единственные ЗАПИСЫВАЮЩИЕ маршруты,
 * минимальная модерация на уровне кампании целиком (см. корневой план
 * фичи §5 — полноценный движок правил соответствия сознательно отложен).
 */
const STATS_WINDOW_DAYS = 30;

@Controller('admin/advertising')
@UseGuards(SessionAuthGuard, AdminGuard)
export class AdminAdvertisingController {
  constructor(
    private readonly adCampaignsService: AdCampaignsService,
    private readonly inventoryService: AdvertisingInventoryService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('overview')
  async getOverview(): Promise<AdminAdvertisingOverviewDto> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (STATS_WINDOW_DAYS - 1));
    since.setUTCHours(0, 0, 0, 0);

    const [
      pendingCampaigns,
      activeCampaigns,
      pausedCampaigns,
      subscriptions,
      impressionCount,
      clickCount,
      recentImpressions,
      recentClicks,
      revenueByCurrencyRows,
      bannedAdvertisers,
    ] = await Promise.all([
      this.adCampaignsService.listPendingReview(),
      this.adCampaignsService.listActive(),
      this.adCampaignsService.listPaused(),
      this.prisma.businessSubscription.findMany({
        select: { businessId: true, tier: true, business: { select: { name: true } } },
      }),
      this.prisma.analyticsEvent.count({ where: { type: 'ad_impression' } }),
      this.prisma.analyticsEvent.count({ where: { type: 'ad_click' } }),
      this.prisma.analyticsEvent.findMany({
        where: { type: 'ad_impression', createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.analyticsEvent.findMany({
        where: { type: 'ad_click', createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      // Не единая `aggregate` по `budgetCents` — `Business.currency` не
      // зафиксирована на одно значение (см. её комментарий в schema.prisma),
      // а `budgetCents` каждой кампании снят в СВОЕЙ валюте (см.
      // `AdCampaignsService.create`). Сложить центы разных валют в одно
      // число значило бы честно посчитать бессмысленную сумму — `groupBy`
      // по `currency` вместо этого.
      this.prisma.adCampaign.groupBy({
        by: ['currency'],
        where: { paymentStatus: 'paid' },
        _sum: { budgetCents: true },
      }),
      this.adCampaignsService.listBannedAdvertisers(),
    ]);

    // Одна строка админ-панели на подписанный бизнес — не горячий путь
    // (только этот overview, не публичная доставка рекламы), поэтому N
    // отдельных вызовов `getInventory` здесь приемлемо, в отличие от
    // `AdEngineService.selectCreative` (см. её Redis-кэш).
    const businesses = await Promise.all(
      subscriptions.map(async (subscription) => {
        const inventory = await this.inventoryService.getInventory(subscription.businessId);
        return {
          businessId: subscription.businessId,
          businessName: subscription.business.name,
          tier: inventory.tier,
          slotLimit: inventory.limit,
          slotsOccupied: inventory.occupied,
          slotsAvailable: inventory.available,
        };
      }),
    );

    const revenueByCurrency: Record<string, number> = {};
    for (const row of revenueByCurrencyRows) {
      revenueByCurrency[row.currency] = row._sum.budgetCents ?? 0;
    }

    // Переиспользует общий `bucketByDay` (`modules/admin/lib/`, уже
    // проверенный на реальных графиках `AdminDashboard`) — та же чистая
    // функция, вызванная дважды (показы/клики — независимые временные
    // ряды), не отдельная реализация "группировки по дню" здесь.
    const impressionsByDay = bucketByDay(
      recentImpressions.map((event) => event.createdAt),
      STATS_WINDOW_DAYS,
    );
    const clicksByDay = bucketByDay(
      recentClicks.map((event) => event.createdAt),
      STATS_WINDOW_DAYS,
    );
    const dailyStats = impressionsByDay.map((point, index) => ({
      date: point.date,
      impressions: point.count,
      clicks: clicksByDay[index].count,
    }));

    return {
      pendingCampaigns,
      activeCampaigns,
      pausedCampaigns,
      businesses,
      bannedAdvertisers,
      dailyStats,
      totals: {
        impressions: impressionCount,
        clicks: clickCount,
        ctr: impressionCount > 0 ? clickCount / impressionCount : 0,
        revenueByCurrency,
      },
    };
  }

  @Post('campaigns/:campaignId/approve')
  approve(@Param('campaignId') campaignId: string): Promise<AdCampaignDto> {
    return this.adCampaignsService.approve(campaignId);
  }

  @Post('campaigns/:campaignId/reject')
  reject(
    @Param('campaignId') campaignId: string,
    @Body() dto: RejectAdCampaignDto,
  ): Promise<AdCampaignDto> {
    return this.adCampaignsService.reject(campaignId, dto.reason);
  }

  /** Тонкая модерация ПОВЕРХ модерации кампании (см. `AdCreativeStatus`'s
   * комментарий в schema.prisma) — снимает один креатив, не трогая
   * `AdCampaign.status` и остальные креативы той же кампании. */
  @Post('creatives/:creativeId/reject')
  rejectCreative(
    @Param('creativeId') creativeId: string,
    @Body() dto: RejectAdCampaignDto,
  ): Promise<AdCreativeDto> {
    return this.adCampaignsService.rejectCreative(creativeId, dto.reason);
  }

  @Post('creatives/:creativeId/approve')
  approveCreative(@Param('creativeId') creativeId: string): Promise<AdCreativeDto> {
    return this.adCampaignsService.approveCreative(creativeId);
  }

  /** Compliance-примитив "banned advertisers" (см. `AdvertiserBan`'s
   * комментарий) — запрещает КОНКРЕТНОМУ бизнесу создавать/отправлять на
   * модерацию рекламные кампании, не трогая его роль паблишера. */
  @Post('businesses/:businessId/ban')
  banAdvertiser(
    @Param('businessId') businessId: string,
    @Body() dto: BanAdvertiserDto,
  ): Promise<void> {
    return this.adCampaignsService.banAdvertiser(businessId, dto.reason);
  }

  @Post('businesses/:businessId/unban')
  unbanAdvertiser(@Param('businessId') businessId: string): Promise<void> {
    return this.adCampaignsService.unbanAdvertiser(businessId);
  }
}
