import { Module } from '@nestjs/common';
import { PostsModule } from '@/modules/posts/posts.module';
import { UsersModule } from '@/modules/users/users.module';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';

@Module({
  // PostsModule — загрузка фото создаёт Post (см. GalleryService.add), а не
  // только строку GalleryImage.
  imports: [UsersModule, PostsModule],
  controllers: [GalleryController],
  providers: [GalleryService],
})
export class GalleryModule {}
