import { Module } from '@nestjs/common';
import { CustomEntitiesController } from './custom-entities.controller';
import { CustomEntitiesService } from './custom-entities.service';

/** Экспортирует `CustomEntitiesService` для AI-инструментов
 * (`create_entity`/`add_field`/`list_entities`, `modules/ai`) — тот же
 * приём, что `CustomWidgetsModule` экспортирует `CustomWidgetsService`. */
@Module({
  controllers: [CustomEntitiesController],
  providers: [CustomEntitiesService],
  exports: [CustomEntitiesService],
})
export class CustomEntitiesModule {}
