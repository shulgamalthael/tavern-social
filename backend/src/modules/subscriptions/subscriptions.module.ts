import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  // NotificationsModule — `SubscriptionsController` шлёт
  // subscription_request/subscription_accepted уведомления (§103), тот же
  // приём, что `FriendsModule`.
  imports: [NotificationsModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
