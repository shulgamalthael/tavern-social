import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PlanSelectionEventService } from './plan-selection-event.service';
import { StripePlanBootstrapService } from './stripe-plan-bootstrap.service';
import { StripeSubscriptionAdapter } from './stripe-subscription-adapter.service';
import { StripeSubscriptionProvider } from './stripe-subscription-provider';
import { SubscriptionWebhookController } from './subscription-webhook.controller';

@Module({
  controllers: [BillingController, SubscriptionWebhookController],
  providers: [
    BillingService,
    PlanSelectionEventService,
    StripePlanBootstrapService,
    { provide: StripeSubscriptionProvider, useClass: StripeSubscriptionAdapter },
  ],
  exports: [BillingService],
})
export class BillingModule {}
