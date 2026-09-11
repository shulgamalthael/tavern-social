import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import type { PaginatedDto } from '@/common/types/paginated';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { toPublicProfile } from '@/modules/users/users.mapper';
import type {
  SubscribeResult,
  SubscriberDto,
  SubscriptionRequestDto,
  SubscriptionRequestsListDto,
  SubscriptionStatusDto,
} from './subscriptions.types';

/** Тот же лимит по умолчанию, что и у `FriendsService.list`/`NotificationsService`. */
const DEFAULT_SUBSCRIBERS_LIMIT = 20;

/**
 * Односторонняя подписка (см. `Subscription`'s комментарий в schema.prisma)
 * — для публичного профиля (`User.isPrivate = false`) остаётся мгновенной,
 * без заявки/подтверждения, как подписка на любой контент-платформе. Для
 * приватного — `subscribe` заводит `SubscriptionRequest` вместо
 * `Subscription`, и только `acceptRequest` превращает её в реальную
 * подписку (§103) — тот же двухшаговый приём, что `FriendsService`
 * `sendRequest`/`acceptRequest`, но без её retry/serializable-логики: в
 * отличие от `Friendship`, `Subscription` не симметрична, встречных заявок
 * «схлопывать» не нужно. Реальная аудитория creator'а для монетизации
 * (`CreatorsService.getEligibility`) и трафика (`PostsService.listFeed`) —
 * не `Friendship`.
 */
@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(followerId: string, followingId: string): Promise<SubscribeResult> {
    if (followerId === followingId) {
      throw new BadRequestException('Нельзя подписаться на самого себя');
    }
    const target = await this.getTargetOrThrow(followingId);

    if (!target.isPrivate) {
      await this.prisma.subscription
        .create({ data: { followerId, followingId } })
        .catch((error: unknown) => {
          // Уже подписан (P2002, уникальная пара) — идемпотентно, не ошибка.
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return null;
          }
          throw error;
        });
      // Подчищаем возможную старую заявку — профиль мог быть приватным на
      // момент, когда была отправлена заявка, и стать публичным позже
      // (см. `Subscription`'s комментарий в schema.prisma).
      await this.prisma.subscriptionRequest.deleteMany({
        where: { senderId: followerId, receiverId: followingId },
      });
      return { status: await this.getStatus(followerId, followingId), outcome: 'followed' };
    }

    const alreadyFollowing = await this.prisma.subscription.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
      select: { id: true },
    });
    if (alreadyFollowing) {
      return {
        status: await this.getStatus(followerId, followingId),
        outcome: 'already-following',
      };
    }

    const created = await this.prisma.subscriptionRequest
      .create({ data: { senderId: followerId, receiverId: followingId } })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return null;
        }
        throw error;
      });

    return {
      status: await this.getStatus(followerId, followingId),
      outcome: created ? 'requested' : 'already-requested',
    };
  }

  /** Одна кнопка «Отписаться»/«Отменить заявку» — отписка и отмена своей
   * исходящей заявки на подписку это одно и то же действие с точки зрения
   * зрителя, оба состояния чистим вместе, не заставляя фронтенд различать их. */
  async unsubscribe(followerId: string, followingId: string): Promise<SubscriptionStatusDto> {
    await Promise.all([
      this.prisma.subscription.deleteMany({ where: { followerId, followingId } }),
      this.prisma.subscriptionRequest.deleteMany({
        where: { senderId: followerId, receiverId: followingId },
      }),
    ]);
    return this.getStatus(followerId, followingId);
  }

  async getStatus(followerId: string, followingId: string): Promise<SubscriptionStatusDto> {
    const [subscription, pendingRequest] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: { followerId_followingId: { followerId, followingId } },
        select: { id: true },
      }),
      this.prisma.subscriptionRequest.findUnique({
        where: { senderId_receiverId: { senderId: followerId, receiverId: followingId } },
        select: { id: true },
      }),
    ]);
    return { isFollowing: Boolean(subscription), hasPendingRequest: Boolean(pendingRequest) };
  }

  /** Принимает входящую заявку на подписку — удаляет `SubscriptionRequest`
   * и создаёт `Subscription`, зеркалит `FriendsService.acceptRequest`.
   * `currentUserId` — владелец приватного профиля (получатель заявки),
   * `senderId` — тот, кто хочет подписаться. */
  async acceptRequest(currentUserId: string, senderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const request = await tx.subscriptionRequest.findUnique({
        where: { senderId_receiverId: { senderId, receiverId: currentUserId } },
      });
      if (!request) {
        throw new NotFoundException('Заявка не найдена');
      }
      await tx.subscriptionRequest.delete({ where: { id: request.id } });
      await tx.subscription
        .create({ data: { followerId: senderId, followingId: currentUserId } })
        .catch(() => null);
    });
  }

  /** Отмена своей исходящей заявки или отклонение чужой входящей — одна и
   * та же операция, зеркалит `FriendsService.respondToRequest`. */
  async respondToRequest(userId: string, otherUserId: string): Promise<{ removed: boolean }> {
    const deleted = await this.prisma.subscriptionRequest.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
    });
    return { removed: deleted.count > 0 };
  }

  async listRequests(currentUserId: string): Promise<SubscriptionRequestsListDto> {
    const [incoming, outgoing] = await Promise.all([
      this.prisma.subscriptionRequest.findMany({
        where: { receiverId: currentUserId },
        include: { sender: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subscriptionRequest.findMany({
        where: { senderId: currentUserId },
        include: { receiver: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const toDto = (user: User, createdAt: Date): SubscriptionRequestDto => ({
      user: toPublicProfile(user),
      createdAt: createdAt.toISOString(),
    });

    return {
      incoming: incoming.map((request) => toDto(request.sender, request.createdAt)),
      outgoing: outgoing.map((request) => toDto(request.receiver, request.createdAt)),
    };
  }

  /** Реальная аудитория creator'а — используется `CreatorsService.
   * getEligibility` вместо бывшего `FriendsService.countFriends`. `count()`,
   * не `findMany`, тот же приём, что `countFriends`. */
  async countFollowers(userId: string): Promise<number> {
    return this.prisma.subscription.count({ where: { followingId: userId } });
  }

  async countFollowing(userId: string): Promise<number> {
    return this.prisma.subscription.count({ where: { followerId: userId } });
  }

  /** Публичный, тот же приём, что `FriendsService.getFriendIds` —
   * `PostsService.listFeed` использует это для дополнительной, независимой
   * от дружбы ветки relationship-фильтра главной ленты. */
  async getFollowingIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.subscription.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    return rows.map((row) => row.followingId);
  }

  /** Подписчики `userId` — курсорная пагинация, не единый запрос с
   * максимальным лимитом (как `UsersController.getFriends`): в отличие от
   * друзей (потолок задачи — 2000), число подписчиков ничем не ограничено. */
  async listFollowers(
    userId: string,
    cursor?: string,
    limit = DEFAULT_SUBSCRIBERS_LIMIT,
  ): Promise<PaginatedDto<SubscriberDto>> {
    const rows = await this.prisma.subscription.findMany({
      where: { followingId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { follower: true },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: page.map((row) => ({
        id: row.follower.id,
        name: row.follower.name,
        tagline: row.follower.tagline,
        avatarUrl: row.follower.avatarUrl,
        city: row.follower.city,
        subscribedAt: row.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /** Кого читает `userId` — тот же приём, что `listFollowers`, только
   * зеркальная сторона отношения. */
  async listFollowing(
    userId: string,
    cursor?: string,
    limit = DEFAULT_SUBSCRIBERS_LIMIT,
  ): Promise<PaginatedDto<SubscriberDto>> {
    const rows = await this.prisma.subscription.findMany({
      where: { followerId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { following: true },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: page.map((row) => ({
        id: row.following.id,
        name: row.following.name,
        tagline: row.following.tagline,
        avatarUrl: row.following.avatarUrl,
        city: row.following.city,
        subscribedAt: row.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  private async getTargetOrThrow(userId: string): Promise<{ id: string; isPrivate: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isPrivate: true },
    });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    return user;
  }
}
