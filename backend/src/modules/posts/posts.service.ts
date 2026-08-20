import { Injectable, NotFoundException } from '@nestjs/common';
import type { Comment, Post, User } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { UsersService } from '@/modules/users/users.service';
import type { CreateCommentDto } from './dto/create-comment.dto';
import type { CreatePostDto } from './dto/create-post.dto';
import type { CommentDto, PostDto, PostSummaryDto } from './posts.types';

/** Лента пока не пагинируется на frontend — отдаём последние N записей целиком. */
const FEED_LIMIT = 100;
/** Комментарии пока не пагинируются — как и лента, но с защитным потолком. */
const COMMENTS_LIMIT = 200;

type PostRelations = { author: User; likes: { id: string }[]; reposts: { id: string }[] };
type PostWithRelations = Post & PostRelations & { repostOf: (Post & PostRelations) | null };

/**
 * Результат переключения репоста. `repost` — созданная запись репоста (только
 * при создании, чтобы frontend мог сразу добавить её в ленту, как при
 * публикации обычного поста); `removedRepostId` — id удалённой записи (только
 * при отмене репоста, чтобы frontend убрал её из ленты). `original` — всегда
 * актуальное состояние оригинала (repostsCount/isRepostedByMe).
 */
export interface RepostToggleDto {
  original: PostDto;
  repost: PostDto | null;
  removedRepostId: string | null;
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async listFeed(currentUserId: string): Promise<PostDto[]> {
    const posts = await this.prisma.post.findMany({
      take: FEED_LIMIT,
      orderBy: { createdAt: 'desc' },
      include: {
        author: true,
        likes: { where: { userId: currentUserId }, select: { id: true } },
        reposts: { where: { authorId: currentUserId }, select: { id: true } },
        repostOf: {
          include: {
            author: true,
            likes: { where: { userId: currentUserId }, select: { id: true } },
            reposts: { where: { authorId: currentUserId }, select: { id: true } },
          },
        },
      },
    });

    return posts.map((post) => this.toDto(post));
  }

  async create(authorId: string, dto: CreatePostDto): Promise<PostDto> {
    const post = await this.prisma.post.create({
      data: { authorId, text: dto.text },
      include: {
        author: true,
        likes: { where: { userId: authorId }, select: { id: true } },
        reposts: { where: { authorId }, select: { id: true } },
        repostOf: {
          include: {
            author: true,
            likes: { where: { userId: authorId }, select: { id: true } },
            reposts: { where: { authorId }, select: { id: true } },
          },
        },
      },
    });
    return this.toDto(post);
  }

  async like(postId: string, userId: string): Promise<{ post: PostDto; created: boolean }> {
    await this.assertPostExists(postId);

    let created = false;
    await this.prisma.$transaction(async (tx) => {
      const like = await tx.postLike.create({ data: { postId, userId } }).catch(() => null);
      if (like) {
        created = true;
        await tx.post.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } });
      }
    });

    const post = await this.getOneForUser(postId, userId);
    return { post, created };
  }

  async unlike(postId: string, userId: string): Promise<PostDto> {
    await this.assertPostExists(postId);

    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.postLike.deleteMany({ where: { postId, userId } });
      if (deleted.count > 0) {
        await tx.post.update({ where: { id: postId }, data: { likesCount: { decrement: 1 } } });
      }
    });

    return this.getOneForUser(postId, userId);
  }

  async repost(postId: string, userId: string): Promise<RepostToggleDto> {
    const original = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, kind: true },
    });
    if (!original) {
      throw new NotFoundException('Запись не найдена');
    }

    let createdId: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      const created = await tx.post
        .create({
          data: { authorId: userId, repostOfId: postId, kind: original.kind, text: '' },
          select: { id: true },
        })
        .catch(() => null);
      if (created) {
        createdId = created.id;
        await tx.post.update({
          where: { id: postId },
          data: { repostsCount: { increment: 1 } },
        });
      }
    });

    const originalDto = await this.getOneForUser(postId, userId);
    const repostDto = createdId ? await this.getOneForUser(createdId, userId) : null;
    return { original: originalDto, repost: repostDto, removedRepostId: null };
  }

  async unrepost(postId: string, userId: string): Promise<RepostToggleDto> {
    await this.assertPostExists(postId);

    let removedId: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.post.findFirst({
        where: { authorId: userId, repostOfId: postId },
        select: { id: true },
      });
      if (existing) {
        await tx.post.delete({ where: { id: existing.id } });
        removedId = existing.id;
        await tx.post.update({
          where: { id: postId },
          data: { repostsCount: { decrement: 1 } },
        });
      }
    });

    const originalDto = await this.getOneForUser(postId, userId);
    return { original: originalDto, repost: null, removedRepostId: removedId };
  }

  async listComments(postId: string): Promise<CommentDto[]> {
    await this.assertPostExists(postId);

    const comments = await this.prisma.comment.findMany({
      where: { postId },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
      take: COMMENTS_LIMIT,
    });

    return comments.map((comment) => this.toCommentDto(comment));
  }

  async createComment(
    postId: string,
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<CommentDto> {
    await this.assertPostExists(postId);

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: { postId, authorId, text: dto.text },
        include: { author: true },
      });
      await tx.post.update({ where: { id: postId }, data: { commentsCount: { increment: 1 } } });
      return created;
    });

    return this.toCommentDto(comment);
  }

  /** Минимальная выборка поста для решения «нужно ли уведомление автору» —
   * без лайков/репостов текущего пользователя, которые тут не нужны. */
  async getPostSummary(
    postId: string,
  ): Promise<{ id: string; author: { id: string }; text: string } | null> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, text: true, authorId: true },
    });
    return post ? { id: post.id, author: { id: post.authorId }, text: post.text } : null;
  }

  private async assertPostExists(postId: string): Promise<void> {
    const exists = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Запись не найдена');
    }
  }

  private async getOneForUser(postId: string, userId: string): Promise<PostDto> {
    const post = await this.prisma.post.findUniqueOrThrow({
      where: { id: postId },
      include: {
        author: true,
        likes: { where: { userId }, select: { id: true } },
        reposts: { where: { authorId: userId }, select: { id: true } },
        repostOf: {
          include: {
            author: true,
            likes: { where: { userId }, select: { id: true } },
            reposts: { where: { authorId: userId }, select: { id: true } },
          },
        },
      },
    });
    return this.toDto(post);
  }

  private toDto(post: PostWithRelations): PostDto {
    return {
      id: post.id,
      author: this.usersService.toPublicProfile(post.author),
      kind: post.kind,
      text: post.text,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      viewsCount: post.viewsCount,
      repostsCount: post.repostsCount,
      isLikedByMe: post.likes.length > 0,
      isRepostedByMe: post.reposts.length > 0,
      createdAt: post.createdAt.toISOString(),
      repostOf: post.repostOf ? this.toSummaryDto(post.repostOf) : null,
    };
  }

  private toSummaryDto(post: Post & PostRelations): PostSummaryDto {
    return {
      id: post.id,
      author: this.usersService.toPublicProfile(post.author),
      text: post.text,
      createdAt: post.createdAt.toISOString(),
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      repostsCount: post.repostsCount,
      isLikedByMe: post.likes.length > 0,
      isRepostedByMe: post.reposts.length > 0,
    };
  }

  private toCommentDto(comment: Comment & { author: User }): CommentDto {
    return {
      id: comment.id,
      postId: comment.postId,
      author: this.usersService.toPublicProfile(comment.author),
      text: comment.text,
      createdAt: comment.createdAt.toISOString(),
    };
  }
}
