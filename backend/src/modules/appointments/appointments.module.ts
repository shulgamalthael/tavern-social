import { Module } from '@nestjs/common';
import { AnalyticsModule } from '@/modules/analytics/analytics.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [AnalyticsModule, PaymentsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
