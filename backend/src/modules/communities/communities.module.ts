import { Module } from '@nestjs/common';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';

@Module({
  controllers: [CommunitiesController],
  providers: [CommunitiesService],
  // Экспортирован для `PostsModule` (`PostsService.listFeed`'s
  // relationship-based фильтр, AI_PLATFORM_ROADMAP.md §73).
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
