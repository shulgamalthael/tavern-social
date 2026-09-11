import { Module } from '@nestjs/common';
import { AdvertisingModule } from '@/modules/advertising/advertising.module';
import { AnalyticsModule } from '@/modules/analytics/analytics.module';
import { AppointmentsModule } from '@/modules/appointments/appointments.module';
import { DiscountsModule } from '@/modules/discounts/discounts.module';
import { NativeAdsModule } from '@/modules/native-ads/native-ads.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { PostsModule } from '@/modules/posts/posts.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { StripeWebhookController } from './stripe-webhook.controller';

/** `AppointmentsModule`/`AdvertisingModule`/`PostsModule`/`NativeAdsModule`
 * imported here (not the other way around) purely so `StripeWebhookController`
 * — the one Stripe webhook for the whole app, see its own comment — can
 * dispatch a `payment_intent.succeeded` event to whichever of `OrdersService`/
 * `AppointmentsService`/`AdCampaignsService`/`PostBoostsService`/
 * `NativeAdCampaignsService` actually owns it (see
 * `StripeWebhookController.handle`). Neither module has a dependency back on
 * Orders — one-way edges, not a cycle. */
@Module({
  imports: [
    PaymentsModule,
    AnalyticsModule,
    DiscountsModule,
    AppointmentsModule,
    AdvertisingModule,
    PostsModule,
    NativeAdsModule,
  ],
  controllers: [OrdersController, StripeWebhookController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
