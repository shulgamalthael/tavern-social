import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import { AdCampaignsService } from './ad-campaigns.service';
import { AdEngineService } from './ad-engine.service';
import type { SelectedAdDto } from './advertising.types';
import { RecordAdEventDto } from './dto/record-ad-event.dto';
import { SelectFeedAdsQueryDto } from './dto/select-feed-ads.query.dto';
import { resolveVisitorCountry } from './lib/resolve-visitor-country';

const DEFAULT_SLOT_COUNT = 3;

/**
 * Доставка баннеров в сайдбары ленты самой Таверны (`widgets/feed`,
 * `AdPlacement.feed_sidebar`, см. её комментарий в schema.prisma) — не
 * `PublicSitesController`'s `.../ads/select`: тот анонимный и требует
 * `businessId` паблишера (чей-то сайт), здесь же зритель — залогиненный
 * пользователь самой Таверны, поэтому `SessionAuthGuard`, а не анонимный
 * доступ. Тот же принцип разделения "выдача/учёт", что и у
 * `NativeAdFeedController` рядом (нативная реклама creator'ов) — это
 * ДРУГОЙ, самостоятельный движок (`AdCampaign`/`AdCreative` из
 * `entities/advertising`, обычные баннеры по ставке), а не альтернатива
 * ему: у Таверны теперь два независимых способа монетизации ленты
 * рекламой, каждый в своей сущности.
 */
@Controller('feed-ads')
@UseGuards(SessionAuthGuard)
export class FeedAdsController {
  constructor(
    private readonly adEngineService: AdEngineService,
    private readonly adCampaignsService: AdCampaignsService,
  ) {}

  @Get('select')
  select(@Query() query: SelectFeedAdsQueryDto, @Req() request: Request): Promise<SelectedAdDto[]> {
    return this.adEngineService.selectCreativesForFeed(
      'feed_sidebar',
      query.count ?? DEFAULT_SLOT_COUNT,
      resolveVisitorCountry(request.ip),
    );
  }

  /** Анализ по сайтам (`AnalyticsEvent`) здесь не пишется — в отличие от
   * `PublicSitesController.recordAdImpression`, у ленты Таверны нет
   * паблишера-бизнеса, которому принадлежала бы эта статистика (см.
   * `AdEngineService.selectCreativesForFeed`'s комментарий). Реальное
   * списание бюджета рекламодателя (`AdCampaignsService.recordImpression`)
   * — уже полноценный источник истины для его собственной статистики
   * кампании. `placement`/`publisherBusinessId` захардкожены, не берутся
   * из `dto` (см. `RecordAdEventDto.placement`'s комментарий) — лента
   * Таверны и так ВСЕГДА `'feed_sidebar'` без паблишера, доверять клиенту
   * здесь нечего; `visitorCountry` всё же реальный, по IP этого запроса. */
  @Post('impression')
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordImpression(@Body() dto: RecordAdEventDto, @Req() request: Request): Promise<void> {
    await this.adCampaignsService.recordImpression(dto.campaignId, {
      placement: 'feed_sidebar',
      publisherBusinessId: null,
      visitorCountry: resolveVisitorCountry(request.ip),
    });
  }

  @Post('click')
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordClick(@Body() dto: RecordAdEventDto, @Req() request: Request): Promise<void> {
    await this.adCampaignsService.recordClick(dto.campaignId, {
      placement: 'feed_sidebar',
      publisherBusinessId: null,
      visitorCountry: resolveVisitorCountry(request.ip),
    });
  }
}
