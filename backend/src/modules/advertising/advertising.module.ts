import { Module } from '@nestjs/common';
import { CurrenciesModule } from '@/modules/currencies/currencies.module';
import { MediaAssetsModule } from '@/modules/media-assets/media-assets.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { AdCampaignsController } from './ad-campaigns.controller';
import { AdCampaignsService } from './ad-campaigns.service';
import { AdEngineService } from './ad-engine.service';
import { AdminAdvertisingController } from './admin-advertising.controller';
import { AdvertisingInventoryService } from './advertising-inventory.service';
import { FeedAdsController } from './feed-ads.controller';

/**
 * `AdEngineService`/`AdvertisingInventoryService` экспортируются — их
 * читают извне: `PublicSitesModule` (анонимная доставка креатива, см.
 * `PublicSitesController`'s `.../ads/select|impression|click`) и `AiModule`
 * (`AddBlockTool`/`InsertCustomWidgetTool` — гейт добавления `adslot`
 * блока). `AdCampaignsService` экспортируется для `OrdersModule`
 * (`StripeWebhookController`'s третья ветка `campaignId`, см. её
 * комментарий) — не наоборот, тот же однонаправленный принцип, что уже
 * применён к `OrdersModule`/`AppointmentsModule`.
 */
@Module({
  imports: [PaymentsModule, MediaAssetsModule, CurrenciesModule],
  controllers: [AdCampaignsController, AdminAdvertisingController, FeedAdsController],
  providers: [AdvertisingInventoryService, AdCampaignsService, AdEngineService],
  exports: [AdvertisingInventoryService, AdCampaignsService, AdEngineService],
})
export class AdvertisingModule {}
