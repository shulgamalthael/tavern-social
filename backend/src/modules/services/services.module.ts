import { Module } from '@nestjs/common';
import { MediaAssetsModule } from '@/modules/media-assets/media-assets.module';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [MediaAssetsModule],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
