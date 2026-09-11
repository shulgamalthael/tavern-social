import { Module } from '@nestjs/common';
import { PostsModule } from '@/modules/posts/posts.module';
import { UsersModule } from '@/modules/users/users.module';
import { ThreadsController } from './threads.controller';
import { ThreadsService } from './threads.service';

@Module({
  // PostsModule — «Переслать пост в чат» (§104): ThreadsService зовёт
  // `PostsService.getShareSummary` и на отправке (проверка доступа
  // отправителя), и на чтении (per-viewer видимость шаренного поста).
  // Однонаправленно — PostsModule не импортирует ThreadsModule, цикла нет.
  imports: [UsersModule, PostsModule],
  controllers: [ThreadsController],
  providers: [ThreadsService],
})
export class ThreadsModule {}
