import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { UsersModule } from '@/modules/users/users.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [UsersModule, NotificationsModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
