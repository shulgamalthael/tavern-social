import { Module } from '@nestjs/common';
import { AnalyticsModule } from '@/modules/analytics/analytics.module';
import { DiscountsModule } from '@/modules/discounts/discounts.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [PaymentsModule, AnalyticsModule, DiscountsModule],
  controllers: [OrdersController, StripeWebhookController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
