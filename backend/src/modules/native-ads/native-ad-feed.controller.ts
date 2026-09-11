import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { RecordNativeAdEventDto } from './dto/record-native-ad-event.dto';
import { RequestNativeAdPayoutDto } from './dto/request-native-ad-payout.dto';
import { SelectNativeAdsDto } from './dto/select-native-ads.dto';
import { NativeAdAssignmentsService } from './native-ad-assignments.service';
import { NativeAdCampaignsService } from './native-ad-campaigns.service';
import { NativeAdFeedService } from './native-ad-feed.service';
import { NativeAdPayoutsService } from './native-ad-payouts.service';
import { NativeAdRevenueService } from './native-ad-revenue.service';
import type {
  CreatorNativeAdDto,
  CreatorRevenueSummaryDto,
  NativeAdFeedItemDto,
  NativeAdPayoutDto,
} from './native-ads.types';

/**
 * Доставка нативной рекламы в собственную ленту зрителя — в отличие от
 * `PublicSitesController`'s `.../ads/select` (анонимная, для сайтов), здесь
 * ленту видит только залогиненный пользователь (`SessionAuthGuard`), и
 * запрос идёт по УЖЕ загруженным клиентом id постов, а не "дай мне рекламу
 * под это место", см. `NativeAdFeedService`'s комментарий.
 */
@Controller('native-ads')
@UseGuards(SessionAuthGuard)
export class NativeAdFeedController {
  constructor(
    private readonly feedService: NativeAdFeedService,
    private readonly campaignsService: NativeAdCampaignsService,
    private readonly assignmentsService: NativeAdAssignmentsService,
    private readonly revenueService: NativeAdRevenueService,
    private readonly payoutsService: NativeAdPayoutsService,
  ) {}

  @Post('feed/select')
  select(@Body() dto: SelectNativeAdsDto): Promise<Record<string, NativeAdFeedItemDto>> {
    return this.feedService.getAdsForPosts(dto.postIds);
  }

  @Post('feed/impression')
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordImpression(@Body() dto: RecordNativeAdEventDto): Promise<void> {
    await this.campaignsService.recordImpression(dto.assignmentId);
  }

  @Post('feed/click')
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordClick(@Body() dto: RecordNativeAdEventDto): Promise<void> {
    await this.campaignsService.recordClick(dto.assignmentId);
  }

  /** Creator Studio → «Реклама» — см. `NativeAdAssignmentsService.
   * listForCreatorUser`'s комментарий про честные, не выдуманные цифры. */
  @Get('my-assignments')
  myAssignments(@CurrentUser() currentUser: RequestUser): Promise<CreatorNativeAdDto[]> {
    return this.assignmentsService.listForCreatorUser(currentUser.id);
  }

  /** Creator Studio → «Доход» (Phase 4) — см. `NativeAdRevenueService.
   * getMyRevenue`'s комментарий. */
  @Get('my-revenue')
  myRevenue(@CurrentUser() currentUser: RequestUser): Promise<CreatorRevenueSummaryDto> {
    return this.revenueService.getMyRevenue(currentUser.id);
  }

  /** Реальные выплаты через Stripe Connect (Phase 5) — см.
   * `NativeAdPayoutsService.requestPayout`'s комментарий. */
  @Post('my-revenue/request-payout')
  requestPayout(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: RequestNativeAdPayoutDto,
  ): Promise<NativeAdPayoutDto> {
    return this.payoutsService.requestPayout(currentUser.id, dto.currency);
  }

  @Get('my-payouts')
  myPayouts(@CurrentUser() currentUser: RequestUser): Promise<NativeAdPayoutDto[]> {
    return this.payoutsService.listMyPayouts(currentUser.id);
  }
}
