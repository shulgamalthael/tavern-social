import { Module } from '@nestjs/common';
import { CreatorsModule } from '@/modules/creators/creators.module';
import { MediaAssetsModule } from '@/modules/media-assets/media-assets.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { AdminNativeAdsController } from './admin-native-ads.controller';
import { NativeAdAssignmentsService } from './native-ad-assignments.service';
import { NativeAdCampaignsController } from './native-ad-campaigns.controller';
import { NativeAdCampaignsService } from './native-ad-campaigns.service';
import { NativeAdFeedController } from './native-ad-feed.controller';
import { NativeAdFeedService } from './native-ad-feed.service';
import { NativeAdPayoutsService } from './native-ad-payouts.service';
import { NativeAdRevenueSettingsService } from './native-ad-revenue-settings.service';
import { NativeAdRevenueService } from './native-ad-revenue.service';

/**
 * Creator Monetization Phase 2 (AI_PLATFORM_ROADMAP.md §80) — независим от
 * `advertising` module (см. `NativeAdCampaignsService`'s комментарий), не
 * импортирует и не импортируется им. `NativeAdCampaignsService`
 * экспортируется для `OrdersModule` (`StripeWebhookController`'s пятая
 * ветка `nativeCampaignId`) — тот же однонаправленный принцип, что и у
 * `AdvertisingModule`.
 *
 * Phase 5 (§83) добавляет ЕДИНСТВЕННУЮ новую межмодульную связь — импорт
 * `CreatorsModule` за её `StripeConnectService` (реальные переводы денег),
 * тот же принцип, что уже применён `OrdersModule` к `AdvertisingModule`/
 * `PostsModule` за их сервисами для диспетчеризации вебхука. Данные
 * `CreatorProfile` по-прежнему читаются напрямую через Prisma везде, где
 * нужна только выборка — эта связь только за реальной Stripe-логикой.
 */
@Module({
  imports: [PaymentsModule, MediaAssetsModule, CreatorsModule],
  controllers: [NativeAdCampaignsController, AdminNativeAdsController, NativeAdFeedController],
  providers: [
    NativeAdCampaignsService,
    NativeAdAssignmentsService,
    NativeAdFeedService,
    NativeAdRevenueSettingsService,
    NativeAdRevenueService,
    NativeAdPayoutsService,
  ],
  exports: [NativeAdCampaignsService],
})
export class NativeAdsModule {}
