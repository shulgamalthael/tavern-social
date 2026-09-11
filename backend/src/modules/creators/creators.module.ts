import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { SubscriptionsModule } from '@/modules/subscriptions/subscriptions.module';
import { AdminCreatorsController } from './admin-creators.controller';
import { CreatorCategoriesService } from './creator-categories.service';
import { CreatorIdentityService } from './creator-identity.service';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { StripeConnectService } from './stripe-connect.service';
import { StripeIdentityWebhookController } from './stripe-identity-webhook.controller';

@Module({
  imports: [SubscriptionsModule, NotificationsModule],
  controllers: [CreatorsController, AdminCreatorsController, StripeIdentityWebhookController],
  providers: [
    CreatorsService,
    CreatorCategoriesService,
    CreatorIdentityService,
    StripeConnectService,
  ],
  exports: [StripeConnectService, CreatorsService],
})
export class CreatorsModule {}
