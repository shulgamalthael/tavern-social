import { Module } from '@nestjs/common';
import { PostsModule } from '@/modules/posts/posts.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [PostsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
