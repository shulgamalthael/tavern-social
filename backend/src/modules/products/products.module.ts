import { Module } from '@nestjs/common';
import { MediaAssetsModule } from '@/modules/media-assets/media-assets.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [MediaAssetsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
