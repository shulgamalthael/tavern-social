import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import {
  assertUploadedFile,
  createImageMulterOptions,
  deleteUploadedFile,
  uploadedFileUrl,
} from '@/common/lib/upload';
import type { RequestUser } from '@/common/types/authenticated-request';
import { MediaAssetsService } from '@/modules/media-assets/media-assets.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import type { BlogPostDto } from './blog-posts.types';
import { BlogPostsService } from './blog-posts.service';

/** Владелец-only — см. `ServicesController`, тот же принцип вложенности и
 * то же разделение с публичным чтением (`PublicSitesController.
 * getPublicBlogPosts`/`getPublicBlogPostBySlug`). Названа `blog-posts`, не
 * `posts` — см. комментарий модели `BlogPost` в schema.prisma о коллизии
 * имён с социальной частью приложения. */
@Controller('businesses/:businessId/blog-posts')
@UseGuards(SessionAuthGuard)
export class BlogPostsController {
  constructor(
    private readonly blogPostsService: BlogPostsService,
    private readonly mediaAssetsService: MediaAssetsService,
  ) {}

  @Get()
  list(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<BlogPostDto[]> {
    return this.blogPostsService.list(businessId, currentUser.id);
  }

  @Post()
  create(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateBlogPostDto,
  ): Promise<BlogPostDto> {
    return this.blogPostsService.create(businessId, currentUser.id, dto);
  }

  @Patch(':postId')
  update(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('postId') postId: string,
    @Body() dto: UpdateBlogPostDto,
  ): Promise<BlogPostDto> {
    return this.blogPostsService.update(businessId, postId, currentUser.id, dto);
  }

  @Delete(':postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('postId') postId: string,
  ): Promise<void> {
    return this.blogPostsService.remove(businessId, postId, currentUser.id);
  }

  /** См. `ProductsController.uploadImage` — тот же приём. */
  @Post('images')
  @UseInterceptors(FileInterceptor('file', createImageMulterOptions('blog-posts')))
  async uploadImage(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ url: string }> {
    assertUploadedFile(file);
    const url = uploadedFileUrl('blog-posts', file.filename);
    try {
      await this.blogPostsService.assertOwnership(businessId, currentUser.id);
    } catch (error) {
      deleteUploadedFile(url);
      throw error;
    }
    await this.mediaAssetsService.record(businessId, url, file.mimetype);
    return { url };
  }
}
