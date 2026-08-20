import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Comment, Post, ReactionType, User } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { UsersService } from '@/modules/users/users.service';
import type { CreateCommentDto } from './dto/create-comment.dto';
import type { CreatePostDto } from './dto/create-post.dto';
import type { CommentDto, PostDto, PostSummaryDto } from './posts.types';

/** Лента пока не пагинируется на frontend — отдаём последние N записей целиком. */
const FEED_LIMIT = 100;
/** Комментарии пока не пагинируются — как и лента, но с защитным потолком. */
const COMMENTS_LIMIT = 200;

type PostRelations = {
  author: User;
  wallOwner: { name: string };
  reactions: { type: ReactionType }[];
  reposts: { id: string }[];
};
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
      include: this.postInclude(currentUserId),
    });

    return posts.map((post) => this.toDto(post));
  }

  /** Стена конкретного пользователя — все посты, где он wallOwner, независимо
   * от того, кто их автор (см. AGENTS.md backend, раздел про стену). */
  async listWall(wallOwnerId: string, currentUserId: string): Promise<PostDto[]> {
    await this.usersService.findByIdOrThrow(wallOwnerId);

    const posts = await this.prisma.post.findMany({
      where: { wallOwnerId },
      take: FEED_LIMIT,
      orderBy: { createdAt: 'desc' },
      include: this.postInclude(currentUserId),
    });

    return posts.map((post) => this.toDto(post));
  }

  async create(authorId: string, dto: CreatePostDto): Promise<PostDto> {
    const wallOwnerId = dto.wallOwnerId ?? authorId;
    if (wallOwnerId !== authorId) {
      // Публикация на чужой стене — получатель должен реально существовать.
      await this.usersService.findByIdOrThrow(wallOwnerId);
    }

    const post = await this.prisma.post.create({
      data: { authorId, wallOwnerId, text: dto.text },
      include: this.postInclude(authorId),
    });
    return this.toDto(post);
  }

  async like(postId: string, userId: string): Promise<{ post: PostDto; created: boolean }> {
    const created = await this.setReaction(postId, userId, 'like');
    const post = await this.getOneForUser(postId, userId);
    return { post, created };
  }

  async unlike(postId: string, userId: string): Promise<PostDto> {
    await this.removeReaction(postId, userId, 'like');
    return this.getOneForUser(postId, userId);
  }

  async dislike(postId: string, userId: string): Promise<{ post: PostDto; created: boolean }> {
    const created = await this.setReaction(postId, userId, 'dislike');
    const post = await this.getOneForUser(postId, userId);
    return { post, created };
  }

  async undislike(postId: string, userId: string): Promise<PostDto> {
    await this.removeReaction(postId, userId, 'dislike');
    return this.getOneForUser(postId, userId);
  }

  async repost(postId: string, userId: string): Promise<RepostToggleDto> {
    const original = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, kind: true, authorId: true },
    });
    if (!original) {
      throw new NotFoundException('Запись не найдена');
    }
    if (original.authorId === userId) {
      throw new BadRequestException('Нельзя репостнуть собственную запись');
    }

    let createdId: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      const created = await tx.post
        .create({
          data: {
            authorId: userId,
            // Репост всегда попадает на свою стену — это твоя собственная
            // публикация о чужом посте, а не запись на чужой стене.
            wallOwnerId: userId,
            repostOfId: postId,
            kind: original.kind,
            text: '',
          },
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

    let parentId: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { id: true, postId: true, parentId: true },
      });
      if (!parent || parent.postId !== postId) {
        throw new BadRequestException('Комментарий для ответа не найден в этой записи');
      }
      // Только один уровень вложенности — ответ на ответ перепривязывается
      // к самому верхнему комментарию треда (см. AGENTS.md backend).
      parentId = parent.parentId ?? parent.id;
    }

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: { postId, authorId, text: dto.text, parentId },
        include: { author: true },
      });
      await tx.post.update({ where: { id: postId }, data: { commentsCount: { increment: 1 } } });
      return created;
    });

    return this.toCommentDto(comment);
  }

  /** Минимальная выборка поста для решения «нужно ли уведомление автору» —
   * без реакций/репостов текущего пользователя, которые тут не нужны. */
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

  /**
   * Ставит реакцию `type`, атомарно снимая предыдущую (если была другая) —
   * одна строка PostReaction на пользователя/пост, а не независимые
   * like/dislike-таблицы (см. AGENTS.md backend, раздел про реакции).
   * Возвращает `true`, если это реально новое состояние (для уведомлений —
   * повторный клик на уже активную реакцию не должен слать уведомление
   * повторно), `false` — если реакция уже была именно такой.
   */
  private async setReaction(postId: string, userId: string, type: ReactionType): Promise<boolean> {
    await this.assertPostExists(postId);

    let created = false;
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.postReaction.findUnique({
        where: { postId_userId: { postId, userId } },
      });
      if (existing?.type === type) return;

      if (existing) {
        await tx.post.update({
          where: { id: postId },
          data:
            existing.type === 'like'
              ? { likesCount: { decrement: 1 } }
              : { dislikesCount: { decrement: 1 } },
        });
        await tx.postReaction.update({ where: { id: existing.id }, data: { type } });
      } else {
        await tx.postReaction.create({ data: { postId, userId, type } });
      }

      await tx.post.update({
        where: { id: postId },
        data:
          type === 'like' ? { likesCount: { increment: 1 } } : { dislikesCount: { increment: 1 } },
      });
      created = true;
    });

    return created;
  }

  /** Снимает реакцию, только если она сейчас именно `type` — DELETE /likes
   * не должен случайно стереть чужую по смыслу активную реакцию dislike. */
  private async removeReaction(postId: string, userId: string, type: ReactionType): Promise<void> {
    await this.assertPostExists(postId);

    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.postReaction.deleteMany({ where: { postId, userId, type } });
      if (deleted.count > 0) {
        await tx.post.update({
          where: { id: postId },
          data:
            type === 'like'
              ? { likesCount: { decrement: 1 } }
              : { dislikesCount: { decrement: 1 } },
        });
      }
    });
  }

  private async getOneForUser(postId: string, userId: string): Promise<PostDto> {
    const post = await this.prisma.post.findUniqueOrThrow({
      where: { id: postId },
      include: this.postInclude(userId),
    });
    return this.toDto(post);
  }

  /** Общий include для поста + его репостнутого оригинала — реакции и «я
   * ли репостнул» всегда относительно `userId`, вызывающего запрос. */
  private postInclude(userId: string) {
    const relations = {
      author: true,
      wallOwner: { select: { name: true } },
      reactions: { where: { userId }, select: { type: true } },
      reposts: { where: { authorId: userId }, select: { id: true } },
    } as const;

    return {
      ...relations,
      repostOf: { include: relations },
    };
  }

  private toDto(post: PostWithRelations): PostDto {
    return {
      id: post.id,
      author: this.usersService.toPublicProfile(post.author),
      wallOwnerId: post.wallOwnerId,
      wallOwnerName: post.wallOwner.name,
      kind: post.kind,
      text: post.text,
      likesCount: post.likesCount,
      dislikesCount: post.dislikesCount,
      commentsCount: post.commentsCount,
      viewsCount: post.viewsCount,
      repostsCount: post.repostsCount,
      isLikedByMe: post.reactions.some((reaction) => reaction.type === 'like'),
      isDislikedByMe: post.reactions.some((reaction) => reaction.type === 'dislike'),
      createdAt: post.createdAt.toISOString(),
      repostOf: post.repostOf ? this.toSummaryDto(post.repostOf) : null,
    };
  }

  private toSummaryDto(post: Post & PostRelations): PostSummaryDto {
    return {
      id: post.id,
      author: this.usersService.toPublicProfile(post.author),
      wallOwnerId: post.wallOwnerId,
      wallOwnerName: post.wallOwner.name,
      text: post.text,
      createdAt: post.createdAt.toISOString(),
      likesCount: post.likesCount,
      dislikesCount: post.dislikesCount,
      commentsCount: post.commentsCount,
      repostsCount: post.repostsCount,
      isLikedByMe: post.reactions.some((reaction) => reaction.type === 'like'),
      isDislikedByMe: post.reactions.some((reaction) => reaction.type === 'dislike'),
    };
  }

  private toCommentDto(comment: Comment & { author: User }): CommentDto {
    return {
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      author: this.usersService.toPublicProfile(comment.author),
      text: comment.text,
      createdAt: comment.createdAt.toISOString(),
    };
  }
}
