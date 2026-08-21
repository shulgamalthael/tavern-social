import { Injectable, NotFoundException } from '@nestjs/common';
import type { GalleryImage } from '@prisma/client';
import { deleteUploadedFile } from '@/common/lib/upload';
import type { PaginatedDto } from '@/common/types/paginated';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PostsService } from '@/modules/posts/posts.service';
import type { GalleryImageDto, GalleryUploadResultDto } from './gallery.types';

/** Тот же лимит по умолчанию, что и у остальных курсорных списков (см.
 * `NotificationsService`) — плитки галереи довольно мелкие, но лимит держим
 * одинаковым для всего проекта, а не подбираем «оптимальный» под каждый
 * список отдельно. */
const DEFAULT_GALLERY_LIMIT = 20;

interface PostReactionCounts {
  id: string;
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  reactions: { type: 'like' | 'dislike' }[];
}

type GalleryImageWithPost = GalleryImage & { post: PostReactionCounts | null };

@Injectable()
export class GalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postsService: PostsService,
  ) {}

  async list(
    userId: string,
    viewerId: string,
    cursor?: string,
    limit = DEFAULT_GALLERY_LIMIT,
  ): Promise<PaginatedDto<GalleryImageDto>> {
    const images = await this.prisma.galleryImage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { post: { select: this.postSelect(viewerId) } },
    });

    const hasMore = images.length > limit;
    const page = hasMore ? images.slice(0, limit) : images;
    return {
      items: page.map((image) => this.toDto(image)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /** Загрузка фото одновременно публикует его как запись на стене/в ленте —
   * галерея и лента синхронизированы по построению: это буквально один и тот
   * же Post, лайки/дизлайки/комментарии к фото — это лайки/дизлайки/
   * комментарии к этой записи (см. `GalleryImageDto`, `schema.prisma`).
   * Возвращает и `post` целиком — frontend дописывает его в ленту/стену
   * сразу же, без отдельного запроса (см. `GalleryGrid.tsx`). */
  async add(userId: string, url: string): Promise<GalleryUploadResultDto> {
    const post = await this.postsService.createFromGalleryUpload(userId, url);
    const image = await this.prisma.galleryImage.create({ data: { userId, url, postId: post.id } });

    return {
      image: {
        id: image.id,
        url: image.url,
        postId: post.id,
        likesCount: post.likesCount,
        dislikesCount: post.dislikesCount,
        commentsCount: post.commentsCount,
        isLikedByMe: post.isLikedByMe,
        isDislikedByMe: post.isDislikedByMe,
        createdAt: image.createdAt.toISOString(),
      },
      post,
    };
  }

  /** Файл на диске и связанная запись Post (вместе с её реакциями/
   * комментариями/уведомлениями — каскадно на уровне БД) удаляются вместе со
   * строкой галереи — иначе файл остаётся сиротой в uploads/gallery, а пост
   * без фото — сиротой в ленте. Не найдено/не принадлежит вызывающему —
   * одна и та же 404, чтобы не палить чужие id. */
  async remove(userId: string, imageId: string): Promise<void> {
    const image = await this.prisma.galleryImage.findUnique({ where: { id: imageId } });
    if (!image || image.userId !== userId) {
      throw new NotFoundException('Изображение не найдено');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.galleryImage.delete({ where: { id: imageId } });
      if (image.postId) {
        await tx.post.delete({ where: { id: image.postId } });
      }
    });
    deleteUploadedFile(image.url);
  }

  /** Реакции — только текущего зрителя (`viewerId`), как и в `PostsService`. */
  private postSelect(viewerId: string) {
    return {
      id: true,
      likesCount: true,
      dislikesCount: true,
      commentsCount: true,
      reactions: { where: { userId: viewerId }, select: { type: true } },
    } as const;
  }

  private toDto(image: GalleryImageWithPost): GalleryImageDto {
    return {
      id: image.id,
      url: image.url,
      postId: image.postId,
      likesCount: image.post?.likesCount ?? 0,
      dislikesCount: image.post?.dislikesCount ?? 0,
      commentsCount: image.post?.commentsCount ?? 0,
      isLikedByMe: image.post?.reactions.some((reaction) => reaction.type === 'like') ?? false,
      isDislikedByMe:
        image.post?.reactions.some((reaction) => reaction.type === 'dislike') ?? false,
      createdAt: image.createdAt.toISOString(),
    };
  }
}
