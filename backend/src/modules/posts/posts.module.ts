import { Module } from '@nestjs/common';
import { CommunitiesModule } from '@/modules/communities/communities.module';
import { FriendsModule } from '@/modules/friends/friends.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { SubscriptionsModule } from '@/modules/subscriptions/subscriptions.module';
import { UsersModule } from '@/modules/users/users.module';
import { LinkPreviewService } from './link-preview.service';
import { PostBoostsService } from './post-boosts.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  // `FriendsModule`/`SubscriptionsModule`/`CommunitiesModule` —
  // relationship-based фильтр главной ленты (`PostsService.listFeed`,
  // AI_PLATFORM_ROADMAP.md §73/§85). `PaymentsModule` — `PostBoostsService`'s
  // `PaymentProvider`.
  imports: [
    UsersModule,
    NotificationsModule,
    FriendsModule,
    SubscriptionsModule,
    CommunitiesModule,
    PaymentsModule,
  ],
  controllers: [PostsController],
  providers: [PostsService, LinkPreviewService, PostBoostsService],
  // GalleryService создаёт Post при загрузке фото (см. GalleryService.add) —
  // без публикации отсюда пришлось бы дублировать логику создания поста.
  // `PostBoostsService` экспортируется для `OrdersModule` (`StripeWebhook
  // Controller`'s четвёртая ветка `postBoostId`) — не наоборот, тот же
  // однонаправленный принцип, что уже применён к `AdvertisingModule`.
  exports: [PostsService, PostBoostsService],
})
export class PostsModule {}
