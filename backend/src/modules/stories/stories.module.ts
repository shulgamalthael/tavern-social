import { Module } from '@nestjs/common';
import { FriendsModule } from '@/modules/friends/friends.module';
import { SubscriptionsModule } from '@/modules/subscriptions/subscriptions.module';
import { UsersModule } from '@/modules/users/users.module';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

// `FriendsModule`/`SubscriptionsModule` — relationship-based фильтр ленты
// историй (`StoriesService.getTray`), тот же набор зависимостей, что у
// `PostsModule` для `listFeed`.
@Module({
  imports: [UsersModule, FriendsModule, SubscriptionsModule],
  controllers: [StoriesController],
  providers: [StoriesService],
})
export class StoriesModule {}
