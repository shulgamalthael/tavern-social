import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { RealtimeModule } from './infrastructure/websocket/realtime.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { CommunitiesModule } from './modules/communities/communities.module';
import { DomainsModule } from './modules/domains/domains.module';
import { FriendsModule } from './modules/friends/friends.module';
import { GalleryModule } from './modules/gallery/gallery.module';
import { GroupsModule } from './modules/groups/groups.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { BlogPostsModule } from './modules/blog-posts/blog-posts.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { FormSubmissionsModule } from './modules/form-submissions/form-submissions.module';
import { MediaAssetsModule } from './modules/media-assets/media-assets.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PostsModule } from './modules/posts/posts.module';
import { ProductsModule } from './modules/products/products.module';
import { PublicSitesModule } from './modules/public-sites/public-sites.module';
import { ServicesModule } from './modules/services/services.module';
import { SearchModule } from './modules/search/search.module';
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
    AuthModule,
    UsersModule,
    NotificationsModule,
    PostsModule,
    ThreadsModule,
    FriendsModule,
    CommunitiesModule,
    GroupsModule,
    GalleryModule,
    SearchModule,
    AdminModule,
    BusinessesModule,
    WebsitesModule,
    DomainsModule,
    ProductsModule,
    OrdersModule,
    DiscountsModule,
    ServicesModule,
    AppointmentsModule,
    BlogPostsModule,
    FormSubmissionsModule,
    MediaAssetsModule,
    AnalyticsModule,
    PublicSitesModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
