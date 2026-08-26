import { Module } from '@nestjs/common';
import { MediaAssetsModule } from '@/modules/media-assets/media-assets.module';
import { WebsitesController } from './websites.controller';
import { WebsitesService } from './websites.service';

@Module({
  imports: [MediaAssetsModule],
  controllers: [WebsitesController],
  providers: [WebsitesService],
  exports: [WebsitesService],
})
export class WebsitesModule {}
