import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Comment, GroupType, Post, PostKind, ReactionType, User } from '@prisma/client';
import { deleteUploadedFile, uploadedFileUrl } from '@/common/lib/upload';
import {
  extractImageUrls,
  substitutePendingImagePlaceholders,
} from '@/common/lib/post-image-placeholders';
import { sanitizePostContent } from '@/common/lib/sanitize-post-content';
import type { PaginatedDto } from '@/common/types/paginated';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CommunitiesService } from '@/modules/communities/communities.service';
import { FriendsService } from '@/modules/friends/friends.service';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';
import { UsersService } from '@/modules/users/users.service';
import type { CreateCommentDto } from './dto/create-comment.dto';
import type { CreatePostDto } from './dto/create-post.dto';
import type { UpdatePostDto } from './dto/update-post.dto';
import { LinkPreviewService } from './link-preview.service';
import type { CommentDto, PostDto, PostSummaryDto, SharedPostDto } from './posts.types';

/** Тот же лимит по умолчанию, что и у `NotificationsService` — курсорная
 * пагинация ленты/стены (см. `listFeed`/`listWall`). */
const DEFAULT_FEED_LIMIT = 20;
/** Комментарии видны сразу под постом без отдельного разворачивания —
 * минимум 4 первых, остальное по «Показать ещё» (см. `listComments`). */
const DEFAULT_COMMENTS_LIMIT = 4;
/** Разумный потолок вложений на один пост — тот же смысл, что и у лимитов
 * загрузки файлов в `common/lib/upload.ts`. */
const MAX_POST_IMAGES = 10;

type PostRelations = {
  author: User;
  wallOwner: { id: string; name: string; isPrivate: boolean } | null;
  group: { name: string; type: GroupType } | null;
  reactions: { type: ReactionType }[];
  reposts: { id: string }[];
  /** Активные (`paymentStatus: 'paid'`, `endsAt` в будущем) продвижения —
   * см. `postInclude`'s `where`. Пусто, если поста никто не продвигает
   * прямо сейчас; никогда больше одной строки (см. `PostBoostsService.
   * create`'s проверку на уже активное продвижение). */
  boosts: { endsAt: Date | null }[];
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
    private readonly linkPreviewService: LinkPreviewService,
    private readonly friendsService: FriendsService,
    private readonly communitiesService: CommunitiesService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /** Relationship-based фильтр (AI_PLATFORM_ROADMAP.md §73) — раньше это
   * был буквально `where: { groupId: null }` (виден абсолютно каждый пост
   * каждому пользователю). Теперь видно только: свои посты, посты друзей,
   * посты тех, на кого подписан (§85 — `Subscription`, сознательно отдельная
   * от `Friendship`: это и есть реальный канал трафика creator'а к
   * подписчикам, независимо от дружбы), посты в сообществах, где состоишь, и
   * — независимо от связи с автором — посты с активным платным продвижением
   * (см. `PostBoost`'s комментарий в schema.prisma). `orderBy` намеренно не
   * меняется: продвинутый пост занимает своё обычное хронологическое место
   * среди всего, что viewer'у и так видно, отличаясь только бейджем
   * «Продвигается» на frontend — не заводим вторую сортировку/закрепление
   * сверху ради того, о чём никто не просил. */
  async listFeed(
    currentUserId: string,
    cursor?: string,
    limit = DEFAULT_FEED_LIMIT,
  ): Promise<PaginatedDto<PostDto>> {
    const [friendIds, followingIds, memberCommunityIds] = await Promise.all([
      this.friendsService.getFriendIds(currentUserId),
      this.subscriptionsService.getFollowingIds(currentUserId),
      this.communitiesService.getMemberCommunityIds(currentUserId),
    ]);

    const posts = await this.prisma.post.findMany({
      // Посты групп в общую ленту не попадают — у группы своя лента
      // (`listGroupPosts`), см. AGENTS.md/план по группам.
      where: {
        groupId: null,
        OR: [
          { authorId: currentUserId },
          { authorId: { in: friendIds } },
          { authorId: { in: followingIds } },
          { communityId: { in: memberCommunityIds } },
          { boosts: { some: { paymentStatus: 'paid', endsAt: { gt: new Date() } } } },
        ],
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: this.postInclude(currentUserId),
    });

    return this.toPage(posts, limit);
  }

  /** Лента группы — доступна всем для открытой группы, только участникам
   * для приватной (403, не 404: существование группы публично, см. план,
   * §5). Проверка через raw Prisma, а не `GroupsService`, чтобы не создавать
   * циклическую зависимость модулей (`GroupsModule` импортирует
   * `PostsModule`, не наоборот) — см. `groups.module.ts`. */
  async listGroupPosts(
    groupId: string,
    currentUserId: string,
    cursor?: string,
    limit = DEFAULT_FEED_LIMIT,
  ): Promise<PaginatedDto<PostDto>> {
    await this.assertGroupContentAccessible(groupId, currentUserId);

    const posts = await this.prisma.post.findMany({
      where: { groupId },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: this.postInclude(currentUserId),
    });

    return this.toPage(posts, limit);
  }

  private async assertGroupContentAccessible(groupId: string, userId: string): Promise<void> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { type: true },
    });
    if (!group) {
      throw new NotFoundException('Группа не найдена');
    }
    if (group.type === 'open') return;

    const membership = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException(
        'Это приватная группа. Для просмотра контента необходимо вступить в группу.',
      );
    }
  }

  private async assertCanPostInGroup(groupId: string, userId: string): Promise<void> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });
    if (!group) {
      throw new NotFoundException('Группа не найдена');
    }
    const membership = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('Публиковать в группе могут только её участники');
    }
  }

  /** Стена конкретного пользователя — все посты, где он wallOwner, независимо
   * от того, кто их автор (см. AGENTS.md backend, раздел про стену).
   * Приватный профиль (§103) — доступ только друзьям/одобренным подписчикам. */
  async listWall(
    wallOwnerId: string,
    currentUserId: string,
    cursor?: string,
    limit = DEFAULT_FEED_LIMIT,
  ): Promise<PaginatedDto<PostDto>> {
    const wallOwner = await this.usersService.findByIdOrThrow(wallOwnerId);
    await this.usersService.assertCanViewRestrictedContent(wallOwner, currentUserId);

    const posts = await this.prisma.post.findMany({
      where: { wallOwnerId },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: this.postInclude(currentUserId),
    });

    return this.toPage(posts, limit);
  }

  /** Общий разбор «взяли limit+1 — если пришло больше limit, значит есть
   * следующая страница» — тот же приём, что и в `NotificationsService.list`. */
  private async toPage(posts: PostWithRelations[], limit: number): Promise<PaginatedDto<PostDto>> {
    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;
    const items = await Promise.all(page.map((post) => this.toDto(post)));
    return {
      items,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /** Собирает финальный HTML из черновика редактора (подстановка
   * `attachment:N` → реально сохранённые файлы, см. PostEditor) и
   * санитизирует его. Общий шаг для `create`/`update`. */
  private prepareContent(rawText: string, imageFiles: Express.Multer.File[]): string {
    const uploadedUrls = imageFiles.map((file) => uploadedFileUrl('posts', file.filename));
    const substituted = substitutePendingImagePlaceholders(rawText, uploadedUrls);
    if (extractImageUrls(substituted).length > MAX_POST_IMAGES) {
      throw new BadRequestException(`В записи может быть не больше ${MAX_POST_IMAGES} изображений`);
    }
    return sanitizePostContent(substituted);
  }

  async create(
    authorId: string,
    dto: CreatePostDto,
    imageFiles: Express.Multer.File[],
  ): Promise<PostDto> {
    if (dto.wallOwnerId && dto.groupId) {
      throw new BadRequestException('Нельзя одновременно указать стену и группу');
    }

    let wallOwnerId: string | null = null;
    if (dto.groupId) {
      await this.assertCanPostInGroup(dto.groupId, authorId);
    } else {
      wallOwnerId = dto.wallOwnerId ?? authorId;
      if (wallOwnerId !== authorId) {
        // Публикация на чужой стене — получатель должен реально существовать,
        // и (§103) стена не должна быть закрытой для автора поста.
        const wallOwner = await this.usersService.findByIdOrThrow(wallOwnerId);
        await this.usersService.assertCanViewRestrictedContent(wallOwner, authorId);
      }
    }
    const groupId = dto.groupId ?? null;

    const sanitized = this.prepareContent(dto.text, imageFiles);
    const uploadedUrls = imageFiles.map((file) => uploadedFileUrl('posts', file.filename));

    const post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: { authorId, wallOwnerId, groupId, text: sanitized },
        include: this.postInclude(authorId),
      });
      if (uploadedUrls.length > 0) {
        await tx.postImage.createMany({
          data: uploadedUrls.map((url, index) => ({ postId: created.id, url, order: index })),
        });
      }
      return created;
    });

    // Резолвит и кэширует превью ссылок сейчас — toDto ниже уже читает
    // только кэш (см. LinkPreviewService.getCachedForContent), чтобы листинг
    // ленты не бил по сети на каждый рендер.
    await this.linkPreviewService.resolveForContent(sanitized);
    return this.toDto(post);
  }

  /** Редактирование собственного поста — та же ownership-проверка, что и у
   * `remove()`. Какие картинки остались, определяется самим присланным
   * текстом (какие `/uploads/posts/...` src в нём ещё есть) — отдельного
   * параметра «что оставить» от клиента не требуется. */
  async update(
    postId: string,
    userId: string,
    dto: UpdatePostDto,
    imageFiles: Express.Multer.File[],
  ): Promise<PostDto> {
    const existing = await this.assertPostAccessible(postId, userId);
    if (existing.authorId !== userId) {
      throw new ForbiddenException('Можно редактировать только свою запись');
    }

    const sanitized = this.prepareContent(dto.text, imageFiles);
    const uploadedUrls = imageFiles.map((file) => uploadedFileUrl('posts', file.filename));
    const keptUrls = new Set(extractImageUrls(sanitized));

    const currentImages = await this.prisma.postImage.findMany({ where: { postId } });
    const removedImages = currentImages.filter((image) => !keptUrls.has(image.url));

    await this.prisma.$transaction(async (tx) => {
      if (removedImages.length > 0) {
        await tx.postImage.deleteMany({
          where: { id: { in: removedImages.map((image) => image.id) } },
        });
      }
      if (uploadedUrls.length > 0) {
        await tx.postImage.createMany({
          data: uploadedUrls.map((url, index) => ({
            postId,
            url,
            order: currentImages.length + index,
          })),
        });
      }
      await tx.post.update({ where: { id: postId }, data: { text: sanitized } });
    });

    for (const image of removedImages) {
      deleteUploadedFile(image.url);
    }

    await this.linkPreviewService.resolveForContent(sanitized);
    return this.getOneForUser(postId, userId);
  }

  /** Автосоздание записи при загрузке фото в галерею — см. GalleryService.add.
   * Всегда на свою стену, без текста, с одной картинкой. Не идёт через
   * `create()`/`CreatePostDto`: тот путь — публичный API композера/редактора,
   * у него нет и не должно быть отдельного параметра для фото галереи (см.
   * AGENTS.md, кнопка «Фото» в композере). Возвращает полный `PostDto` (не
   * только id) — `GalleryService` отдаёт его наружу вместе с
   * `GalleryImageDto`, чтобы frontend мог сразу дописать пост в ленту/стену,
   * не делая второй запрос. */
  async createFromGalleryUpload(authorId: string, imageUrl: string): Promise<PostDto> {
    // Текст целиком собран сервером — единственная интерполяция это
    // imageUrl, пришедший из multer/uploadedFileUrl (GalleryController.upload),
    // не пользовательский HTML, поэтому sanitizePostContent здесь не нужен и
    // даже помешал бы: его allowlist для img[src] разрешает только
    // /uploads/posts/, а не /uploads/gallery/.
    const text = `<img src="${imageUrl}" alt="">`;

    const post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: { authorId, wallOwnerId: authorId, text },
        include: this.postInclude(authorId),
      });
      await tx.postImage.create({ data: { postId: created.id, url: imageUrl, order: 0 } });
      return created;
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
    const original = await this.assertPostAccessible(postId, userId);
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
    await this.assertPostAccessible(postId, userId);

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

  /** Курсор по верхнеуровневым комментариям (`parentId: null`) — каждый
   * тянется вместе со своими `replies`, итоговый `items` остаётся плоским
   * массивом (top + все их replies), как и раньше, чтобы фронтовая
   * группировка (`CommentList.groupByParent`) не менялась. */
  async listComments(
    postId: string,
    currentUserId: string,
    cursor?: string,
    limit = DEFAULT_COMMENTS_LIMIT,
  ): Promise<PaginatedDto<CommentDto>> {
    await this.assertPostAccessible(postId, currentUserId);

    const topLevel = await this.prisma.comment.findMany({
      where: { postId, parentId: null },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'asc' },
      include: {
        author: true,
        replies: { include: { author: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    const hasMore = topLevel.length > limit;
    const page = hasMore ? topLevel.slice(0, limit) : topLevel;
    const items = page
      .flatMap((comment) => [comment, ...comment.replies])
      .map((comment) => this.toCommentDto(comment));

    return {
      items,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async createComment(
    postId: string,
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<CommentDto> {
    await this.assertPostAccessible(postId, authorId);

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

  /** Удаляет собственный комментарий — только автор (та же проверка, что и
   * `remove()` у поста). Верхнеуровневый комментарий каскадно удаляет свои
   * ответы (`Comment.parent` — `onDelete: Cascade`), поэтому `commentsCount`
   * поста декрементируется не на 1, а на реально удалённое число строк
   * (сам комментарий + его ответы, если это тред). */
  async removeComment(postId: string, commentId: string, userId: string): Promise<void> {
    await this.assertPostAccessible(postId, userId);

    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, authorId: true, parentId: true },
    });
    if (!comment || comment.postId !== postId) {
      throw new NotFoundException('Комментарий не найден');
    }
    if (comment.authorId !== userId) {
      throw new ForbiddenException('Можно удалить только свой комментарий');
    }

    await this.prisma.$transaction(async (tx) => {
      const repliesCount = comment.parentId
        ? 0
        : await tx.comment.count({ where: { parentId: commentId } });
      await tx.comment.delete({ where: { id: commentId } });
      await tx.post.update({
        where: { id: postId },
        data: { commentsCount: { decrement: 1 + repliesCount } },
      });
    });
  }

  /** Минимальная выборка поста для решения «нужно ли уведомление автору» —
   * без реакций/репостов текущего пользователя, которые тут не нужны.
   * `images` нужен только чтобы socket-payload мог пометить уведомление
   * как «про фото» (см. PostsController — `hasImage` в payload). */
  async getPostSummary(
    postId: string,
  ): Promise<{ id: string; author: { id: string }; text: string; images: string[] } | null> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, text: true, authorId: true },
    });
    return post
      ? {
          id: post.id,
          author: { id: post.authorId },
          text: post.text,
          images: extractImageUrls(post.text),
        }
      : null;
  }

  /**
   * Удаляет запись со стены — только собственную (проверка авторства, не
   * владения стеной: если A написал на стене B, удалить может только A, как
   * и в других соцсетях). Фото галереи (`galleryImage` заполнен) — та же
   * запись, что и плитка в галерее (см. AGENTS.md) — удаляются вместе со
   * связанной `GalleryImage` и файлом на диске в одной транзакции, тем же
   * способом, что и `GalleryService.remove` (обратный путь удаления той же
   * пары строк): прямое удаление одного Post оставило бы `GalleryImage.
   * postId` обнулённым (`onDelete: SetNull`), осиротив плитку в галерее —
   * без реакций/комментариев и без владельца, который мог бы её удалить.
   * Файлы всех картинок поста (`PostImage`) тоже удаляются с диска — Prisma
   * cascade чистит только строки в БД, не файловую систему.
   */
  async remove(postId: string, userId: string): Promise<void> {
    await this.assertPostAccessible(postId, userId);

    const post = await this.prisma.post.findUniqueOrThrow({
      where: { id: postId },
      select: {
        authorId: true,
        galleryImage: { select: { id: true, url: true } },
        images: { select: { url: true } },
      },
    });
    if (post.authorId !== userId) {
      throw new ForbiddenException('Можно удалить только свою запись');
    }

    await this.prisma.$transaction(async (tx) => {
      if (post.galleryImage) {
        await tx.galleryImage.delete({ where: { id: post.galleryImage.id } });
      }
      await tx.post.delete({ where: { id: postId } });
    });

    if (post.galleryImage) {
      deleteUploadedFile(post.galleryImage.url);
    }
    for (const image of post.images) {
      deleteUploadedFile(image.url);
    }
  }

  /**
   * Модераторское удаление — без проверки авторства (см. `remove()` выше
   * для обычного пути). Отдельный метод, а не параметр `skipOwnerCheck` в
   * `remove()`: тут ещё и другой набор проверок доступа (`assertPostAccessible`
   * не нужен — админ видит любой пост), и `repostOfId` обрабатывается прямо
   * здесь, а не через `unrepost()`, у которого своя обязательная проверка
   * `userId === author`. Если удаляемый пост сам репост — декрементирует
   * `repostsCount` оригинала (та же бухгалтерия, что и `unrepost()`), иначе
   * `repostsCount` на оригинале стало бы враньём после чужого удаления.
   */
  async removeAsAdmin(postId: string): Promise<void> {
    const post = await this.prisma.post.findUniqueOrThrow({
      where: { id: postId },
      select: {
        repostOfId: true,
        galleryImage: { select: { id: true, url: true } },
        images: { select: { url: true } },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      if (post.galleryImage) {
        await tx.galleryImage.delete({ where: { id: post.galleryImage.id } });
      }
      if (post.repostOfId) {
        await tx.post.update({
          where: { id: post.repostOfId },
          data: { repostsCount: { decrement: 1 } },
        });
      }
      await tx.post.delete({ where: { id: postId } });
    });

    if (post.galleryImage) {
      deleteUploadedFile(post.galleryImage.url);
    }
    for (const image of post.images) {
      deleteUploadedFile(image.url);
    }
  }

  /** Существование + доступ к посту приватной группы ИЛИ приватной стены
   * (§103) — `NotFoundException` в обоих случаях (не подтверждаем
   * существование чужого id, та же логика, что и в `GalleryService`, см.
   * план по группам §5 и `UsersService.assertCanViewRestrictedContent`'s
   * комментарий). Используется всеми действиями над конкретным постом
   * (реакции/комментарии/репост/редактирование/удаление), кроме
   * `listFeed`/`listGroupPosts`, у которых своя проверка на уровне списка
   * (`assertGroupContentAccessible`), и `listWall`, у которой своя —
   * тот же гейт, что здесь, но до выборки списка, а не одного поста. */
  private async assertPostAccessible(
    postId: string,
    userId: string,
  ): Promise<{ id: string; authorId: string; groupId: string | null; kind: PostKind }> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        groupId: true,
        wallOwnerId: true,
        kind: true,
        group: { select: { type: true } },
        wallOwner: { select: { id: true, isPrivate: true } },
      },
    });
    if (!post) {
      throw new NotFoundException('Запись не найдена');
    }
    if (post.groupId && post.group?.type === 'private') {
      const membership = await this.prisma.groupMembership.findUnique({
        where: { groupId_userId: { groupId: post.groupId, userId } },
      });
      if (!membership) {
        throw new NotFoundException('Запись не найдена');
      }
    }
    // Пост на чужой приватной стене — та же проверка, что уже есть у
    // `listWall`/`create`, но для отдельных действий над уже существующим
    // постом (лайк/комментарий/репост/...), а не только за просмотр стены
    // целиком: без неё чужой postId с приватной стены (полученный до того,
    // как её владелец сделал страницу приватной, или как-то ещё) оставался
    // полностью доступен для реакций/комментариев/чтения через toDto.
    if (post.wallOwner) {
      const canView = await this.usersService.canViewRestrictedContent(post.wallOwner, userId);
      if (!canView) {
        throw new NotFoundException('Запись не найдена');
      }
    }
    return { id: post.id, authorId: post.authorId, groupId: post.groupId, kind: post.kind };
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
    await this.assertPostAccessible(postId, userId);

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
    await this.assertPostAccessible(postId, userId);

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
      wallOwner: { select: { id: true, name: true, isPrivate: true } },
      group: { select: { name: true, type: true } },
      reactions: { where: { userId }, select: { type: true } },
      reposts: { where: { authorId: userId }, select: { id: true } },
      boosts: {
        where: { paymentStatus: 'paid', endsAt: { gt: new Date() } },
        select: { endsAt: true },
        orderBy: { endsAt: 'desc' },
        take: 1,
      },
    } as const;

    return {
      ...relations,
      repostOf: { include: relations },
    };
  }

  /**
   * Единая точка правды «может ли `viewerId` сейчас видеть этот пост» — та
   * же логика доступа, что `assertPostAccessible` (приватная группа,
   * приватная стена автора, §103), но без throw: используется и на
   * отправке «Переслать в чат» (`ThreadsService.sendMessage` — там
   * `!== 'visible'` превращается в `NotFoundException`, отправитель не
   * может поделиться тем, что сам не видит), и на каждом чтении уже
   * отправленного сообщения с `sharedPostId` конкретным получателем —
   * поэтому результат не кэшируется и не сохраняется как снимок, доступ
   * мог измениться уже после пересылки (см. `SharedPostDto`'s комментарий). */
  async getShareSummary(postId: string, viewerId: string): Promise<SharedPostDto> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: this.postInclude(viewerId),
    });
    if (!post) {
      return { status: 'not_found' };
    }
    if (post.groupId && post.group?.type === 'private') {
      const membership = await this.prisma.groupMembership.findUnique({
        where: { groupId_userId: { groupId: post.groupId, userId: viewerId } },
      });
      if (!membership) {
        return { status: 'restricted', author: this.usersService.toPublicProfile(post.author) };
      }
    }
    if (post.wallOwner) {
      const canView = await this.usersService.canViewRestrictedContent(post.wallOwner, viewerId);
      if (!canView) {
        return { status: 'restricted', author: this.usersService.toPublicProfile(post.author) };
      }
    }
    return { status: 'visible', post: await this.toSummaryDto(post) };
  }

  private async toDto(post: PostWithRelations): Promise<PostDto> {
    const [linkPreviews, repostOf] = await Promise.all([
      this.linkPreviewService.getCachedForContent(post.text),
      post.repostOf ? this.toSummaryDto(post.repostOf) : Promise.resolve(null),
    ]);

    return {
      id: post.id,
      author: this.usersService.toPublicProfile(post.author),
      wallOwnerId: post.wallOwnerId,
      wallOwnerName: post.wallOwner?.name ?? null,
      groupId: post.groupId,
      groupName: post.group?.name ?? null,
      kind: post.kind,
      text: post.text,
      images: extractImageUrls(post.text),
      linkPreviews,
      likesCount: post.likesCount,
      dislikesCount: post.dislikesCount,
      commentsCount: post.commentsCount,
      viewsCount: post.viewsCount,
      repostsCount: post.repostsCount,
      isLikedByMe: post.reactions.some((reaction) => reaction.type === 'like'),
      isDislikedByMe: post.reactions.some((reaction) => reaction.type === 'dislike'),
      isRepostedByMe: post.reposts.length > 0,
      isPromoted: post.boosts.length > 0,
      promotedUntil: post.boosts[0]?.endsAt?.toISOString() ?? null,
      createdAt: post.createdAt.toISOString(),
      repostOf,
    };
  }

  private async toSummaryDto(post: Post & PostRelations): Promise<PostSummaryDto> {
    const linkPreviews = await this.linkPreviewService.getCachedForContent(post.text);

    return {
      id: post.id,
      author: this.usersService.toPublicProfile(post.author),
      wallOwnerId: post.wallOwnerId,
      wallOwnerName: post.wallOwner?.name ?? null,
      groupId: post.groupId,
      groupName: post.group?.name ?? null,
      text: post.text,
      images: extractImageUrls(post.text),
      linkPreviews,
      createdAt: post.createdAt.toISOString(),
      likesCount: post.likesCount,
      dislikesCount: post.dislikesCount,
      commentsCount: post.commentsCount,
      repostsCount: post.repostsCount,
      isLikedByMe: post.reactions.some((reaction) => reaction.type === 'like'),
      isDislikedByMe: post.reactions.some((reaction) => reaction.type === 'dislike'),
      isRepostedByMe: post.reposts.length > 0,
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
