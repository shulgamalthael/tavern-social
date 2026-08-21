import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { UsersModule } from '@/modules/users/users.module';
import { LinkPreviewService } from './link-preview.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [UsersModule, NotificationsModule],
  controllers: [PostsController],
  providers: [PostsService, LinkPreviewService],
  // GalleryService создаёт Post при загрузке фото (см. GalleryService.add) —
  // без публикации отсюда пришлось бы дублировать логику создания поста.
  exports: [PostsService],
})
export class PostsModule {}
