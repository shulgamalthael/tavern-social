import { Body, Controller, Delete, Get, Param, Post as HttpPost, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { RealtimeGateway } from '@/infrastructure/websocket/realtime.gateway';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import type { CommentDto, PostDto } from './posts.types';
import { PostsService, type RepostToggleDto } from './posts.service';

@Controller('posts')
@UseGuards(SessionAuthGuard)
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  @Get()
  async list(@CurrentUser() currentUser: RequestUser): Promise<PostDto[]> {
    return this.postsService.listFeed(currentUser.id);
  }

  @Get('wall/:userId')
  async listWall(
    @CurrentUser() currentUser: RequestUser,
    @Param('userId') userId: string,
  ): Promise<PostDto[]> {
    return this.postsService.listWall(userId, currentUser.id);
  }

  @HttpPost()
  async create(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: CreatePostDto,
  ): Promise<PostDto> {
    return this.postsService.create(currentUser.id, dto);
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
        post: { id: post.id, text: post.text },
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
        post: { id: original.id, text: original.text },
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
  async listComments(@Param('id') postId: string): Promise<CommentDto[]> {
    return this.postsService.listComments(postId);
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
        post: { id: post.id, text: post.text },
        commentText: comment.text,
      });
    }

    return comment;
  }
}
