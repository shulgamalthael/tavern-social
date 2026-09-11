import { Module } from '@nestjs/common';
import { BusinessesModule } from '@/modules/businesses/businesses.module';
import { CreatorsModule } from '@/modules/creators/creators.module';
import { FriendsModule } from '@/modules/friends/friends.module';
import { SubscriptionsModule } from '@/modules/subscriptions/subscriptions.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [FriendsModule, SubscriptionsModule, CreatorsModule, BusinessesModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
