import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { extractImageUrls } from '@/common/lib/post-image-placeholders';
import { deleteUploadedFile } from '@/common/lib/upload';
import type { PaginatedDto } from '@/common/types/paginated';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PostsService } from '@/modules/posts/posts.service';
import type {
  AdminCommunityDto,
  AdminGroupDto,
  AdminPostDto,
  AdminStatsDto,
  AdminUserDto,
} from './admin.types';
import type { BanUserDto } from './dto/ban-user.dto';
import type { ListAdminCommunitiesDto } from './dto/list-admin-communities.dto';
import type { ListAdminGroupsDto } from './dto/list-admin-groups.dto';
import type { ListAdminPostsDto } from './dto/list-admin-posts.dto';
import type { ListAdminUsersDto } from './dto/list-admin-users.dto';
import type { SetUserRoleDto } from './dto/set-user-role.dto';
import { bucketByDay } from './lib/bucket-by-day';

const STATS_WINDOW_DAYS = 30;
const TOP_AUTHORS_LIMIT = 5;
const TOP_CIRCLES_LIMIT = 5;
const TABLE_TAG_PATTERN = /<table[\s>]/i;
const LINK_TAG_PATTERN = /<a\s/i;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postsService: PostsService,
  ) {}

  async getStats(): Promise<AdminStatsDto> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (STATS_WINDOW_DAYS - 1));
    since.setUTCHours(0, 0, 0, 0);

    const [
      usersTotal,
      bannedTotal,
      postsTotal,
      commentsTotal,
      groupsTotal,
      communitiesTotal,
      recentUsers,
      recentPosts,
      topAuthorsGrouped,
      topGroups,
      topCommunities,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isBanned: true } }),
      this.prisma.post.count(),
      this.prisma.comment.count(),
      this.prisma.group.count(),
      this.prisma.community.count(),
      this.prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.post.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.post.groupBy({
        by: ['authorId'],
        _count: { _all: true },
        orderBy: { _count: { authorId: 'desc' } },
        take: TOP_AUTHORS_LIMIT,
      }),
      this.prisma.group.findMany({
        orderBy: { membersCount: 'desc' },
        take: TOP_CIRCLES_LIMIT,
        select: { id: true, name: true, avatarUrl: true, membersCount: true },
      }),
      this.prisma.community.findMany({
        orderBy: { membersCount: 'desc' },
        take: TOP_CIRCLES_LIMIT,
        select: { id: true, name: true, membersCount: true },
      }),
    ]);

    const topAuthorIds = topAuthorsGrouped.map((row) => row.authorId);
    const topAuthorUsers = await this.prisma.user.findMany({
      where: { id: { in: topAuthorIds } },
      select: { id: true, name: true, avatarUrl: true },
    });
    const authorById = new Map(topAuthorUsers.map((user) => [user.id, user]));

    return {
      totals: {
        users: usersTotal,
        bannedUsers: bannedTotal,
        posts: postsTotal,
        comments: commentsTotal,
        groups: groupsTotal,
        communities: communitiesTotal,
      },
      usersByDay: bucketByDay(
        recentUsers.map((u) => u.createdAt),
        STATS_WINDOW_DAYS,
      ),
      postsByDay: bucketByDay(
        recentPosts.map((p) => p.createdAt),
        STATS_WINDOW_DAYS,
      ),
      topAuthors: topAuthorsGrouped.flatMap((row) => {
        const author = authorById.get(row.authorId);
        // Автор мог быть удалён между groupBy и этим select — крайне
        // маловероятная гонка, но не 500 из-за неё, просто пропускаем строку.
        if (!author) return [];
        return [
          {
            userId: author.id,
            name: author.name,
            avatarUrl: author.avatarUrl,
            postsCount: row._count._all,
          },
        ];
      }),
      topGroups: topGroups.map((group) => ({
        id: group.id,
        name: group.name,
        avatarUrl: group.avatarUrl,
        membersCount: group.membersCount,
      })),
      // У Community нет своей картинки (см. AdminCommunityDto) — на дашборде
      // это просто именованный ряд без аватара.
      topCommunities: topCommunities.map((community) => ({
        id: community.id,
        name: community.name,
        avatarUrl: null,
        membersCount: community.membersCount,
      })),
    };
  }

  async listUsers(dto: ListAdminUsersDto): Promise<PaginatedDto<AdminUserDto>> {
    const limit = dto.limit ?? 20;
    const search = dto.search?.trim();

    // `OR` (поиск) и остальные условия — оба уровня `AND`-совместимы:
    // Prisma сама объединяет ключи объекта через `AND`, поэтому `OR` внутри
    // и `role`/`isBanned` рядом с ним работают как «(имя ИЛИ email) И роль
    // И статус», а не перезаписывают друг друга.
    const where: Prisma.UserWhereInput = {
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(dto.role && dto.role !== 'all' ? { role: dto.role } : {}),
      ...(dto.status === 'banned' ? { isBanned: true } : {}),
      ...(dto.status === 'active' ? { isBanned: false } : {}),
    };

    const users = await this.prisma.user.findMany({
      where,
      take: limit + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { posts: true } } },
    });

    const hasMore = users.length > limit;
    const page = hasMore ? users.slice(0, limit) : users;
    return {
      items: page.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        isBanned: user.isBanned,
        bannedAt: user.bannedAt?.toISOString() ?? null,
        bannedReason: user.bannedReason,
        createdAt: user.createdAt.toISOString(),
        postsCount: user._count.posts,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async banUser(id: string, adminId: string, dto: BanUserDto): Promise<AdminUserDto> {
    if (id === adminId) {
      throw new BadRequestException('Нельзя забанить самого себя');
    }
    const target = await this.prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) {
      throw new NotFoundException('Пользователь не найден');
    }
    if (target.role === 'admin') {
      throw new BadRequestException('Нельзя забанить другого администратора');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { isBanned: true, bannedAt: new Date(), bannedReason: dto.reason ?? null },
      include: { _count: { select: { posts: true } } },
    });
    return this.toUserDto(user);
  }

  async unbanUser(id: string): Promise<AdminUserDto> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isBanned: false, bannedAt: null, bannedReason: null },
      include: { _count: { select: { posts: true } } },
    });
    return this.toUserDto(user);
  }

  /** Назначение/снятие роли admin — единственный способ выдать права
   * администратора через UI (раньше только `promote-admin.ts` bootstrap-
   * скрипт напрямую в БД). Держит два инварианта: админ не может изменить
   * свою же роль (та же защита, что и у бана/удаления самого себя) и в
   * системе всегда остаётся хотя бы один администратор — иначе `/admin`
   * стал бы безвозвратно недоступен никому. */
  async setUserRole(id: string, adminId: string, dto: SetUserRoleDto): Promise<AdminUserDto> {
    if (id === adminId) {
      throw new BadRequestException('Нельзя изменить свою собственную роль');
    }
    const target = await this.prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) {
      throw new NotFoundException('Пользователь не найден');
    }
    if (target.role === dto.role) {
      return this.toUserDto(
        await this.prisma.user.findUniqueOrThrow({
          where: { id },
          include: { _count: { select: { posts: true } } },
        }),
      );
    }

    if (dto.role === 'user' && target.role === 'admin') {
      const adminCount = await this.prisma.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        throw new BadRequestException('Нельзя снять права последнего администратора');
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      include: { _count: { select: { posts: true } } },
    });
    return this.toUserDto(user);
  }

  /** Полное удаление аккаунта — каскад в схеме чистит все связанные строки
   * (посты, комментарии, дружбы и т. д., см. `onDelete: Cascade` в
   * `schema.prisma`), здесь остаётся только то, что каскад не видит: файлы
   * аватара/обложки на диске (тем же приёмом, что `UsersService.setAvatar`). */
  async deleteUser(id: string, adminId: string): Promise<void> {
    if (id === adminId) {
      throw new BadRequestException('Нельзя удалить самого себя');
    }
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { avatarUrl: true, coverUrl: true, role: true },
    });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    if (user.role === 'admin') {
      throw new BadRequestException('Нельзя удалить другого администратора');
    }

    await this.prisma.user.delete({ where: { id } });
    deleteUploadedFile(user.avatarUrl);
    deleteUploadedFile(user.coverUrl);
  }

  async listPosts(dto: ListAdminPostsDto): Promise<PaginatedDto<AdminPostDto>> {
    const limit = dto.limit ?? 20;
    const search = dto.search?.trim();

    const where: Prisma.PostWhereInput = {
      // У карточки-репоста `text` всегда пустой (см. `AdminPostDto.text` —
      // в списке показывается текст оригинала), поэтому поиск по тексту
      // репоста ищет в `repostOf.text`, иначе ни один репост не находился бы.
      // Поиск по `id` — тоже `contains`, а не точное совпадение: админ может
      // вставить id, скопированный из URL/логов, не обязательно целиком.
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: 'insensitive' } },
              { text: { contains: search, mode: 'insensitive' } },
              { repostOf: { text: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(dto.type === 'repost' ? { repostOfId: { not: null } } : {}),
      ...(dto.type === 'original' ? { repostOfId: null } : {}),
      ...(dto.location === 'wall' ? { groupId: null } : {}),
      ...(dto.location === 'group' ? { groupId: { not: null } } : {}),
    };

    const posts = await this.prisma.post.findMany({
      where,
      take: limit + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { name: true, avatarUrl: true } },
        group: { select: { name: true } },
        repostOf: { select: { text: true } },
      },
    });

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;
    return {
      items: page.map((post) => {
        const content = post.repostOf ? post.repostOf.text : post.text;
        return {
          id: post.id,
          text: content,
          isRepost: post.repostOf !== null,
          images: extractImageUrls(content),
          hasTable: TABLE_TAG_PATTERN.test(content),
          hasLink: LINK_TAG_PATTERN.test(content),
          authorId: post.authorId,
          authorName: post.author.name,
          authorAvatarUrl: post.author.avatarUrl,
          groupId: post.groupId,
          groupName: post.group?.name ?? null,
          createdAt: post.createdAt.toISOString(),
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
        };
      }),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async deletePost(id: string): Promise<void> {
    await this.postsService.removeAsAdmin(id);
  }

  async listGroups(dto: ListAdminGroupsDto): Promise<PaginatedDto<AdminGroupDto>> {
    const limit = dto.limit ?? 20;
    const search = dto.search?.trim();

    const where: Prisma.GroupWhereInput = search
      ? {
          OR: [
            { id: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const groups = await this.prisma.group.findMany({
      where,
      take: limit + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { posts: true } } },
    });

    const hasMore = groups.length > limit;
    const page = hasMore ? groups.slice(0, limit) : groups;
    return {
      items: page.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        type: group.type,
        avatarUrl: group.avatarUrl,
        coverUrl: group.coverUrl,
        membersCount: group.membersCount,
        postsCount: group._count.posts,
        createdAt: group.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /** Участники и заявки на вступление удаляются каскадом (`onDelete: Cascade`
   * в схеме), а посты группы — нет: `Post.groupId` там намеренно `SetNull`,
   * чтобы удаление группы не стирало молча чужой авторский контент (см.
   * комментарий у `Post.groupId` в schema.prisma) — они просто перестают
   * быть привязаны к группе. */
  async deleteGroup(id: string): Promise<void> {
    const group = await this.prisma.group.findUnique({
      where: { id },
      select: { avatarUrl: true, coverUrl: true },
    });
    if (!group) {
      throw new NotFoundException('Группа не найдена');
    }

    await this.prisma.group.delete({ where: { id } });
    deleteUploadedFile(group.avatarUrl);
    deleteUploadedFile(group.coverUrl);
  }

  async listCommunities(dto: ListAdminCommunitiesDto): Promise<PaginatedDto<AdminCommunityDto>> {
    const limit = dto.limit ?? 20;
    const search = dto.search?.trim();

    const where: Prisma.CommunityWhereInput = search
      ? {
          OR: [
            { id: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const communities = await this.prisma.community.findMany({
      where,
      take: limit + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { posts: true } } },
    });

    const hasMore = communities.length > limit;
    const page = hasMore ? communities.slice(0, limit) : communities;
    return {
      items: page.map((community) => ({
        id: community.id,
        name: community.name,
        about: community.about,
        cover: community.cover,
        membersCount: community.membersCount,
        postsCount: community._count.posts,
        createdAt: community.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /** См. `deleteGroup` — та же логика: членства каскадом, посты остаются с
   * `communityId: null` вместо удаления. */
  async deleteCommunity(id: string): Promise<void> {
    const community = await this.prisma.community.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!community) {
      throw new NotFoundException('Сообщество не найдено');
    }

    await this.prisma.community.delete({ where: { id } });
  }

  private toUserDto(user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: AdminUserDto['role'];
    isBanned: boolean;
    bannedAt: Date | null;
    bannedReason: string | null;
    createdAt: Date;
    _count: { posts: number };
  }): AdminUserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isBanned: user.isBanned,
      bannedAt: user.bannedAt?.toISOString() ?? null,
      bannedReason: user.bannedReason,
      createdAt: user.createdAt.toISOString(),
      postsCount: user._count.posts,
    };
  }
}
