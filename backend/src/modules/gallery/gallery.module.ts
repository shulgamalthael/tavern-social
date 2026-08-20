import { Module } from '@nestjs/common';
import { UsersModule } from '@/modules/users/users.module';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';

@Module({
  imports: [UsersModule],
  controllers: [GalleryController],
  providers: [GalleryService],
})
export class GalleryModule {}
