import { Module } from '@nestjs/common';
import { CustomWidgetsController } from './custom-widgets.controller';
import { CustomWidgetsService } from './custom-widgets.service';

@Module({
  controllers: [CustomWidgetsController],
  providers: [CustomWidgetsService],
  exports: [CustomWidgetsService],
})
export class CustomWidgetsModule {}
