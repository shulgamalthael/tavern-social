import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post as HttpPost,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import { createImageMulterOptions } from '@/common/lib/upload';
import type { RequestUser } from '@/common/types/authenticated-request';
import type { PaginatedDto } from '@/common/types/paginated';
import { RealtimeGateway } from '@/infrastructure/websocket/realtime.gateway';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostBoostDto } from './dto/create-post-boost.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostBoostsService } from './post-boosts.service';
import type { CommentDto, PostDto } from './posts.types';
import { PostsService, type RepostToggleDto } from './posts.service';

/** Тот же потолок, что и `MAX_POST_IMAGES` в `PostsService` — multer должен
 * отбраковать лишние файлы ещё на уровне парсинга запроса. */
const MAX_POST_IMAGES = 10;

@Controller('posts')
@UseGuards(SessionAuthGuard)
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly postBoostsService: PostBoostsService,
  ) {}

  @Get()
  async list(
    @CurrentUser() currentUser: RequestUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedDto<PostDto>> {
    return this.postsService.listFeed(currentUser.id, query.cursor, query.limit);
  }

  @Get('wall/:userId')
  async listWall(
    @CurrentUser() currentUser: RequestUser,
    @Param('userId') userId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedDto<PostDto>> {
    return this.postsService.listWall(userId, currentUser.id, query.cursor, query.limit);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') postId: string,
  ): Promise<void> {
    await this.postsService.remove(postId, currentUser.id);
  }

  @HttpPost()
  @UseInterceptors(FilesInterceptor('images', MAX_POST_IMAGES, createImageMulterOptions('posts')))
  async create(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: CreatePostDto,
    @UploadedFiles() images: Express.Multer.File[] | undefined,
  ): Promise<PostDto> {
    return this.postsService.create(currentUser.id, dto, images ?? []);
  }

  /** Instagram-style продвижение (AI_PLATFORM_ROADMAP.md §73) — см.
   * `PostBoostsService.create`'s комментарий. */
  @HttpPost(':id/boost')
  async boost(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') postId: string,
    @Body() dto: CreatePostBoostDto,
  ): Promise<{ clientSecret: string }> {
    return this.postBoostsService.create(postId, currentUser.id, dto);
  }

  @Patch(':id')
  @UseInterceptors(FilesInterceptor('images', MAX_POST_IMAGES, createImageMulterOptions('posts')))
  async update(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') postId: string,
    @Body() dto: UpdatePostDto,
    @UploadedFiles() images: Express.Multer.File[] | undefined,
  ): Promise<PostDto> {
    return this.postsService.update(postId, currentUser.id, dto, images ?? []);
  }

  @HttpPost(':id/likes')
  async like(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') postId: string,
  ): Promise<PostDto> {
    const { post, created } = await this.postsService.like(postId, currentUser.id);

    if (created && post.author.id !== currentUser.id) {
      const {
        id: notificationId,
        actorCount,
        actor,
        isNew,
      } = await this.notificationsService.notifyPostInteraction({
        type: 'post_like',
        recipientId: post.author.id,
        actorId: currentUser.id,
        postId: post.id,
      });
      this.realtimeGateway.emitToUser(post.author.id, 'notification:new', {
        notificationId,
        type: 'post_like',
        actor,
        actorCount,
        isNew,
        post: { id: post.id, text: post.text, hasImage: post.images.length > 0 },
      });
    }

    return post;
  }

  @Delete(':id/likes')
  async unlike(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') postId: string,
  ): Promise<PostDto> {
    return this.postsService.unlike(postId, currentUser.id);
  }

  // Лайк и дизлайк взаимоисключающие (единая реакция, см.
  // PostsService.setReaction) — дизлайк не шлёт уведомление: это приватный
  // сигнал автору контента не нужен, в отличие от лайка/репоста/комментария.
  @HttpPost(':id/dislikes')
  async dislike(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') postId: string,
  ): Promise<PostDto> {
    const { post } = await this.postsService.dislike(postId, currentUser.id);
    return post;
  }

  @Delete(':id/dislikes')
  async undislike(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') postId: string,
  ): Promise<PostDto> {
    return this.postsService.undislike(postId, currentUser.id);
  }

  @HttpPost(':id/reposts')
  async repost(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') postId: string,
  ): Promise<RepostToggleDto> {
    const result = await this.postsService.repost(postId, currentUser.id);
    const { original } = result;

    if (result.repost && original.author.id !== currentUser.id) {
      const {
        id: notificationId,
        actorCount,
        actor,
        isNew,
      } = await this.notificationsService.notifyPostInteraction({
        type: 'post_repost',
        recipientId: original.author.id,
        actorId: currentUser.id,
        postId: original.id,
      });
      this.realtimeGateway.emitToUser(original.author.id, 'notification:new', {
        notificationId,
        type: 'post_repost',
        actor,
        actorCount,
        isNew,
        post: { id: original.id, text: original.text, hasImage: original.images.length > 0 },
      });
    }

    return result;
  }

  @Delete(':id/reposts')
  async unrepost(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') postId: string,
  ): Promise<RepostToggleDto> {
    return this.postsService.unrepost(postId, currentUser.id);
  }

  @Get(':id/comments')
  async listComments(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') postId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedDto<CommentDto>> {
    return this.postsService.listComments(postId, currentUser.id, query.cursor, query.limit);
  }

  @HttpPost(':id/comments')
  async createComment(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') postId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentDto> {
    const comment = await this.postsService.createComment(postId, currentUser.id, dto);
    const post = await this.postsService.getPostSummary(postId);

    if (post && post.author.id !== currentUser.id) {
      const {
        id: notificationId,
        actorCount,
        actor,
        isNew,
      } = await this.notificationsService.notifyPostInteraction({
        type: 'post_comment',
        recipientId: post.author.id,
        actorId: currentUser.id,
        postId: post.id,
        commentId: comment.id,
      });
      this.realtimeGateway.emitToUser(post.author.id, 'notification:new', {
        notificationId,
        type: 'post_comment',
        actor,
        actorCount,
        isNew,
        post: { id: post.id, text: post.text, hasImage: post.images.length > 0 },
        commentText: comment.text,
      });
    }

    return comment;
  }

  @Delete(':id/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeComment(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') postId: string,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    await this.postsService.removeComment(postId, commentId, currentUser.id);
  }
}
