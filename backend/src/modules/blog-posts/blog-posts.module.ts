import { Module } from '@nestjs/common';
import { MediaAssetsModule } from '@/modules/media-assets/media-assets.module';
import { BlogPostsController } from './blog-posts.controller';
import { BlogPostsService } from './blog-posts.service';

@Module({
  imports: [MediaAssetsModule],
  controllers: [BlogPostsController],
  providers: [BlogPostsService],
  exports: [BlogPostsService],
})
export class BlogPostsModule {}
