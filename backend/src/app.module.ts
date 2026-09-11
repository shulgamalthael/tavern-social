import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { UploadsRetentionModule } from './infrastructure/uploads/uploads-retention.module';
import { RealtimeModule } from './infrastructure/websocket/realtime.module';
import { AdminModule } from './modules/admin/admin.module';
import { AdvertisingModule } from './modules/advertising/advertising.module';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { CommunitiesModule } from './modules/communities/communities.module';
import { CreatorsModule } from './modules/creators/creators.module';
import { CurrenciesModule } from './modules/currencies/currencies.module';
import { DomainsModule } from './modules/domains/domains.module';
import { FriendsModule } from './modules/friends/friends.module';
import { GalleryModule } from './modules/gallery/gallery.module';
import { GroupsModule } from './modules/groups/groups.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { BlogPostsModule } from './modules/blog-posts/blog-posts.module';
import { CustomEntitiesModule } from './modules/custom-entities/custom-entities.module';
import { CustomWidgetsModule } from './modules/custom-widgets/custom-widgets.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { FormSubmissionsModule } from './modules/form-submissions/form-submissions.module';
import { MediaAssetsModule } from './modules/media-assets/media-assets.module';
import { NativeAdsModule } from './modules/native-ads/native-ads.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PostsModule } from './modules/posts/posts.module';
import { ProductsModule } from './modules/products/products.module';
import { PublicSitesModule } from './modules/public-sites/public-sites.module';
import { RulesModule } from './modules/rules/rules.module';
import { ServicesModule } from './modules/services/services.module';
import { Web3Module } from './modules/web3/web3.module';
import { SearchModule } from './modules/search/search.module';
import { StoriesModule } from './modules/stories/stories.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { ThreadsModule } from './modules/threads/threads.module';
import { UsersModule } from './modules/users/users.module';
import { WebsitesModule } from './modules/websites/websites.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
    PrismaModule,
    RedisModule,
    RealtimeModule,
    UploadsRetentionModule,
    AuthModule,
    UsersModule,
    NotificationsModule,
    PostsModule,
    ThreadsModule,
    FriendsModule,
    SubscriptionsModule,
    CommunitiesModule,
    GroupsModule,
    GalleryModule,
    StoriesModule,
    SearchModule,
    AdminModule,
    BusinessesModule,
    WebsitesModule,
    DomainsModule,
    ProductsModule,
    OrdersModule,
    DiscountsModule,
    BillingModule,
    ServicesModule,
    AppointmentsModule,
    BlogPostsModule,
    FormSubmissionsModule,
    MediaAssetsModule,
    AnalyticsModule,
    PublicSitesModule,
    RulesModule,
    CustomWidgetsModule,
    CustomEntitiesModule,
    Web3Module,
    AiModule,
    AdvertisingModule,
    CreatorsModule,
    CurrenciesModule,
    NativeAdsModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
