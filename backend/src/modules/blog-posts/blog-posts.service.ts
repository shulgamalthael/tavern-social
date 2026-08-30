import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { BlogPost } from '@prisma/client';
import { slugify } from '@/modules/businesses/lib/slugify';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { CreateBlogPostDto } from './dto/create-blog-post.dto';
import type { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import type { BlogPostDto, PublicBlogPostDto } from './blog-posts.types';

const MAX_SLUG_ATTEMPTS = 30;

/** Владелец-CRUD постов блога одного бизнеса — почти буквальное зеркало
 * `ServicesService`/`ProductsService` (см. их комментарии для полного
 * обоснования паттернов: вложенность под `/businesses/:businessId/blog-
 * posts`, разделение владелец/публика, генерация уникального slug в рамках
 * бизнеса). Единственное реальное отличие — здесь нет анонимного
 * ЗАПИСЫВАЮЩЕГО эндпоинта вообще: посты пишет только владелец, посетитель
 * сайта только читает, поэтому нет ни одного из рисков вроде подмены
 * цены/cross-tenant injection, что были у `OrdersService`/
 * `AppointmentsService`. */
@Injectable()
export class BlogPostsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string, ownerId: string): Promise<BlogPostDto[]> {
    await this.assertOwnership(businessId, ownerId);
    const posts = await this.prisma.blogPost.findMany({
      where: { businessId },
      orderBy: { order: 'asc' },
    });
    return posts.map((post) => this.toDto(post));
  }

  /** Проверяет существование бизнеса, а не только фильтрует по нему — без
   * этого несуществующий/удалённый `businessId` тихо отдавал бы `200 []`
   * вместо `404`, как у `ProductsService.listPublic`/`ServicesService.
   * listPublic` (обе зовут `getBusiness`, которая падает `NotFoundException`).
   * Найдено crash-тестированием Phase 13 — до этого поведение молча
   * расходилось с остальными витринами. */
  async listPublic(businessId: string): Promise<PublicBlogPostDto[]> {
    await this.assertBusinessExists(businessId);
    const posts = await this.prisma.blogPost.findMany({
      where: { businessId, isPublished: true },
      orderBy: { order: 'asc' },
    });
    return posts.map((post) => this.toPublicDto(post));
  }

  /** `null`, не 404 — вызывающий код (`PublicSitesController.getPublicBlog
   * PostBySlug`) сам решает, как показать «нет такого поста» (см. `/blog/
   * [postSlug]` на frontend), тот же приём, что `resolveSitePage` уже
   * применяет к обычным страницам сайта. */
  async getPublicBySlug(businessId: string, slug: string): Promise<PublicBlogPostDto | null> {
    const post = await this.prisma.blogPost.findUnique({
      where: { businessId_slug: { businessId, slug } },
    });
    if (!post || !post.isPublished) return null;
    return this.toPublicDto(post);
  }

  async create(businessId: string, ownerId: string, dto: CreateBlogPostDto): Promise<BlogPostDto> {
    await this.assertOwnership(businessId, ownerId);
    const slug = await this.resolveSlug(businessId, dto.slug, dto.title);
    const count = await this.prisma.blogPost.count({ where: { businessId } });

    const post = await this.prisma.blogPost.create({
      data: {
        businessId,
        title: dto.title,
        slug,
        excerpt: dto.excerpt ?? '',
        content: dto.content ?? '',
        coverImage: dto.coverImage ?? null,
        isPublished: dto.isPublished ?? false,
        order: count,
        seoTitle: dto.seoTitle?.trim() || null,
        seoDescription: dto.seoDescription?.trim() || null,
      },
    });
    return this.toDto(post);
  }

  async update(
    businessId: string,
    postId: string,
    ownerId: string,
    dto: UpdateBlogPostDto,
  ): Promise<BlogPostDto> {
    await this.assertOwnership(businessId, ownerId);
    await this.findOwnedPost(businessId, postId);

    const slug =
      dto.slug !== undefined
        ? await this.resolveSlug(businessId, dto.slug, dto.slug, postId)
        : undefined;

    const post = await this.prisma.blogPost.update({
      where: { id: postId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(dto.excerpt !== undefined ? { excerpt: dto.excerpt } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.coverImage !== undefined ? { coverImage: dto.coverImage } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
        ...(dto.seoTitle !== undefined ? { seoTitle: dto.seoTitle.trim() || null } : {}),
        ...(dto.seoDescription !== undefined
          ? { seoDescription: dto.seoDescription.trim() || null }
          : {}),
      },
    });
    return this.toDto(post);
  }

  async remove(businessId: string, postId: string, ownerId: string): Promise<void> {
    await this.assertOwnership(businessId, ownerId);
    await this.findOwnedPost(businessId, postId);
    await this.prisma.blogPost.delete({ where: { id: postId } });
  }

  async assertOwnership(businessId: string, ownerId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
  }

  private async assertBusinessExists(businessId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
  }

  private async findOwnedPost(businessId: string, postId: string): Promise<BlogPost> {
    const post = await this.prisma.blogPost.findUnique({ where: { id: postId } });
    if (!post || post.businessId !== businessId) {
      throw new NotFoundException('Пост не найден');
    }
    return post;
  }

  private async resolveSlug(
    businessId: string,
    desired: string | undefined,
    fallbackSource: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugify(desired || fallbackSource);

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const existing = await this.prisma.blogPost.findUnique({
        where: { businessId_slug: { businessId, slug: candidate } },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return candidate;
    }

    return `${base}-${Date.now()}`;
  }

  private toDto(post: BlogPost): BlogPostDto {
    return {
      id: post.id,
      businessId: post.businessId,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      coverImage: post.coverImage,
      isPublished: post.isPublished,
      order: post.order,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }

  private toPublicDto(post: BlogPost): PublicBlogPostDto {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      coverImage: post.coverImage,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      createdAt: post.createdAt.toISOString(),
    };
  }
}
