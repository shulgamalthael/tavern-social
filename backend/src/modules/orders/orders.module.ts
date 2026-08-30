import { Module } from '@nestjs/common';
import { AnalyticsModule } from '@/modules/analytics/analytics.module';
import { AppointmentsModule } from '@/modules/appointments/appointments.module';
import { DiscountsModule } from '@/modules/discounts/discounts.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { StripeWebhookController } from './stripe-webhook.controller';

/** `AppointmentsModule` imported here (not the other way around) purely so
 * `StripeWebhookController` — the one Stripe webhook for the whole app, see
 * its own comment — can dispatch a `payment_intent.succeeded` event to
 * whichever of `OrdersService`/`AppointmentsService` actually owns it (see
 * `StripeWebhookController.handle`). `AppointmentsModule` itself has no
 * dependency back on Orders — this is a one-way edge, not a cycle. */
@Module({
  imports: [PaymentsModule, AnalyticsModule, DiscountsModule, AppointmentsModule],
  controllers: [OrdersController, StripeWebhookController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
