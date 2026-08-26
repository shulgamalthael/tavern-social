import { Module } from '@nestjs/common';
import { PaymentProvider } from './payment-provider';
import { StripeAdapter } from './stripe-adapter.service';

@Module({
  providers: [{ provide: PaymentProvider, useClass: StripeAdapter }],
  exports: [PaymentProvider],
})
export class PaymentsModule {}
