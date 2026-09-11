import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { OAuthProvider, User } from '@prisma/client';
import { deleteUploadedFile } from '@/common/lib/upload';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { FriendsService } from '@/modules/friends/friends.service';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { UpdateSettingsDto } from './dto/update-settings.dto';
import * as usersMapper from './users.mapper';
import type { MeProfile, PublicProfile } from './users.types';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friendsService: FriendsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(data: { email: string; passwordHash: string; name: string }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  /** Находит пользователя по уже привязанному провайдеру входа (`OAuthAccount`,
   * см. `schema.prisma`) — id провайдера (`sub` у Google), не email (тот у
   * провайдера в принципе может смениться). */
  async findByOAuthAccount(
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<User | null> {
    const link = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: true },
    });
    return link?.user ?? null;
  }

  /** Привязывает провайдера к УЖЕ существующему пользователю (найденному по
   * email) — авто-линковка при первом входе через новый провайдер на
   * знакомый email, см. `AuthService.findOrCreateOAuthUser`. */
  async linkOAuthAccount(
    userId: string,
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<void> {
    await this.prisma.oAuthAccount.create({ data: { userId, provider, providerAccountId } });
  }

  /** Заводит пользователя БЕЗ пароля (`passwordHash: null`) — единственный
   * способ входа для него сначала — тот же провайдер, что создал аккаунт;
   * пароль можно завести позже отдельным флоу (не реализован в этой
   * итерации — см. AI_PLATFORM_ROADMAP.md). Создание пользователя и
   * привязка провайдера — одна Prisma nested-write, не два отдельных
   * запроса, чтобы никогда не оставить пользователя без единственного
   * способа входа при сбое между шагами. */
  async createFromOAuth(data: {
    email: string;
    name: string;
    provider: OAuthProvider;
    providerAccountId: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: null,
        oauthAccounts: {
          create: { provider: data.provider, providerAccountId: data.providerAccountId },
        },
      },
    });
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    await this.findByIdOrThrow(id);
    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        tagline: dto.tagline,
        // Частичное обновление — undefined значит «поле не пришло в запросе»
        // (оставить как есть), а не «очистить», в отличие от пустой строки.
        ...(dto.about !== undefined ? { about: dto.about } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
      },
    });
  }

  /** Заменяет аватар/обложку: старый файл (если был) удаляется с диска —
   * иначе каждая смена картинки оставляла бы мусор в uploads/. */
  async setAvatar(id: string, url: string): Promise<User> {
    const user = await this.findByIdOrThrow(id);
    deleteUploadedFile(user.avatarUrl);
    return this.prisma.user.update({ where: { id }, data: { avatarUrl: url } });
  }

  async setCover(id: string, url: string): Promise<User> {
    const user = await this.findByIdOrThrow(id);
    deleteUploadedFile(user.coverUrl);
    return this.prisma.user.update({ where: { id }, data: { coverUrl: url } });
  }

  async updateSettings(id: string, dto: UpdateSettingsDto): Promise<User> {
    await this.findByIdOrThrow(id);
    return this.prisma.user.update({
      where: { id },
      data: {
        quietHours: dto.quietHours,
        showPresence: dto.showPresence,
        allowStrangerInvites: dto.allowStrangerInvites,
        morningDigest: dto.morningDigest,
        isPrivate: dto.isPrivate,
      },
    });
  }

  /** Доступ к контенту приватного профиля (§103) — всё, кроме верхнего
   * блока (обложка/аватар/имя/тэглайн), см. `UserProfileDto.canViewFullProfile`
   * и вызовы этого метода в `PostsService.listWall`/`create`,
   * `GalleryController.list`, `UsersController.getFriends`/`getFollowers`/
   * `getFollowing`. Публичный профиль, сам владелец и админы (модерация) —
   * всегда доступны; иначе только друзья или одобренные подписчики. */
  async canViewRestrictedContent(
    target: Pick<User, 'id' | 'isPrivate'>,
    viewerId: string,
  ): Promise<boolean> {
    if (!target.isPrivate || target.id === viewerId) return true;
    const viewer = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: { role: true },
    });
    if (viewer?.role === 'admin') return true;
    const [{ isFriend }, { isFollowing }] = await Promise.all([
      this.friendsService.getStatus(viewerId, target.id),
      this.subscriptionsService.getStatus(viewerId, target.id),
    ]);
    return isFriend || isFollowing;
  }

  async assertCanViewRestrictedContent(
    target: Pick<User, 'id' | 'isPrivate'>,
    viewerId: string,
  ): Promise<void> {
    if (!(await this.canViewRestrictedContent(target, viewerId))) {
      throw new ForbiddenException('Эта страница приватная');
    }
  }

  toPublicProfile(user: User): PublicProfile {
    return usersMapper.toPublicProfile(user);
  }

  toMeProfile(user: User): Omit<MeProfile, 'followersCount' | 'followingCount' | 'friendsCount'> {
    return usersMapper.toMeProfile(user);
  }
}
