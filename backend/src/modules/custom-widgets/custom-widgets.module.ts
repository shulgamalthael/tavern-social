import { Module } from '@nestjs/common';
import { CustomWidgetCatalogGcService } from './custom-widget-catalog-gc.service';
import { CustomWidgetsController } from './custom-widgets.controller';
import { CustomWidgetsService } from './custom-widgets.service';
import { WidgetCatalogController } from './widget-catalog.controller';

@Module({
  controllers: [CustomWidgetsController, WidgetCatalogController],
  providers: [CustomWidgetsService, CustomWidgetCatalogGcService],
  exports: [CustomWidgetsService],
})
export class CustomWidgetsModule {}
