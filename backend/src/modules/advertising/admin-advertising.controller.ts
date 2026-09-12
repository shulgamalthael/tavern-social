import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AdminGuard } from '@/common/guards/admin.guard';
import { bucketByDay } from '@/modules/admin/lib/bucket-by-day';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import {
  convertUsingRates,
  ExchangeRatesService,
} from '@/modules/currencies/exchange-rates.service';
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
    private readonly exchangeRatesService: ExchangeRatesService,
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
      campaignsForPerformance,
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
      // Разбивка по кампаниям (`campaignPerformance` ниже) — ВСЕ кампании,
      // кроме `draft` (никогда не отправлялся на модерацию, гарантированно
      // нулевая активность). Отдельный лёгкий `select`, не переиспользует
      // `listPendingReview`/`listActive`/`listPaused` (те тянут `creatives`
      // целиком через `include` — здесь эти поля не нужны, а `rejected`/
      // `completed` кампании эти три списка вообще не покрывают).
      // Без `orderBy: { spentCents: 'desc' }` — та же причина, что и у
      // `revenueByCurrency` выше: сортировать сырые центы РАЗНЫХ валют как
      // одно измерение значило бы честно вычислить бессмысленный порядок
      // (кампания в UAH с тем же числом центов, что и в USD, потратила на
      // порядки меньше реальных денег). Сортируется ниже, ПОСЛЕ приведения
      // к USD через `ExchangeRatesService` — тот же приём, что у
      // `AdCampaignsService.getPlacementInsights`.
      this.prisma.adCampaign.findMany({
        where: { status: { not: 'draft' } },
        select: {
          id: true,
          name: true,
          status: true,
          advertiserBusinessId: true,
          advertiserBusiness: { select: { name: true } },
          impressionsServed: true,
          clicksServed: true,
          spentCents: true,
          budgetCents: true,
          currency: true,
        },
      }),
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

    // Один запрос курсов на весь список, не по одному на кампанию — тот же
    // приём, что `AdCampaignsService.getPlacementInsights`.
    const rates = await this.exchangeRatesService.getRatesToUsd();
    const campaignPerformance = campaignsForPerformance
      .map((campaign) => ({
        campaignId: campaign.id,
        campaignName: campaign.name,
        businessId: campaign.advertiserBusinessId,
        businessName: campaign.advertiserBusiness.name,
        status: campaign.status,
        impressionsServed: campaign.impressionsServed,
        clicksServed: campaign.clicksServed,
        ctr:
          campaign.impressionsServed > 0 ? campaign.clicksServed / campaign.impressionsServed : 0,
        spentCents: campaign.spentCents,
        budgetCents: campaign.budgetCents,
        currency: campaign.currency,
        // Только для сортировки ниже, НЕ часть DTO — `null`, если курс для
        // этой валюты недоступен (см. `convertUsingRates`'s комментарий),
        // такие строки сортируются в конец, а не поднимаются наверх из-за
        // случайного порядка `null`.
        usdSpentCentsForSort: convertUsingRates(campaign.spentCents, campaign.currency, rates),
      }))
      .sort((a, b) => (b.usdSpentCentsForSort ?? -Infinity) - (a.usdSpentCentsForSort ?? -Infinity))
      .map(({ usdSpentCentsForSort: _usdSpentCentsForSort, ...row }) => row);

    return {
      pendingCampaigns,
      activeCampaigns,
      pausedCampaigns,
      businesses,
      bannedAdvertisers,
      dailyStats,
      campaignPerformance,
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
