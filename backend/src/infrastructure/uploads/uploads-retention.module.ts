import { Module } from '@nestjs/common';
import { UploadsRetentionService } from './uploads-retention.service';

/**
 * Отдельный модуль, не часть `ThreadsModule`/`AiModule` — `uploads/messages/`
 * общий каталог для обеих систем (см. `UploadsRetentionService`'s
 * комментарий), фоновая уборка в нём не принадлежит ни одной из них
 * персонально. `PrismaService` берётся из глобального `PrismaModule`, здесь
 * дополнительно импортировать не нужно.
 */
@Module({
  providers: [UploadsRetentionService],
})
export class UploadsRetentionModule {}
