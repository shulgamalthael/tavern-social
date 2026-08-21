import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { PostsModule } from '@/modules/posts/posts.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  // `PostsModule` — для ленты группы (`PostsService.listGroupPosts`, см.
  // `GroupsController.listPosts`) и переиспользования `PostsService.create`
  // при публикации в группе. Однонаправленно: `PostsModule` не импортирует
  // `GroupsModule` обратно — проверки членства внутри `PostsService` делаются
  // напрямую через Prisma, не через `GroupsService` (см. groups.service.ts).
  imports: [PostsModule, NotificationsModule],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
