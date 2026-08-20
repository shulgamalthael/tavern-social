import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PresenceService } from '@/infrastructure/redis/presence.service';
import { toPublicProfile } from '@/modules/users/users.mapper';
import type {
  FriendDto,
  FriendRequestDto,
  FriendRequestsListDto,
  FriendshipStatusDto,
  RespondToRequestResult,
  SendRequestResult,
} from './friends.types';

type TransactionClient = Prisma.TransactionClient;

/** Как в `NotificationsService`: read-modify-write без блокировки строки
 * (проверить встречную заявку → создать заявку/дружбу) уязвим к гонке —
 * если два пользователя отправляют заявку друг другу одновременно, оба
 * запроса могут не увидеть заявку другого и создать по отдельной pending-
 * заявке вместо мгновенной дружбы (проверено нагрузочным тестом). */
const MAX_SERIALIZATION_RETRIES = 8;
const RETRY_BASE_DELAY_MS = 15;

/**
 * Дружба заводится через заявку/подтверждение (`FriendRequest` →
 * `Friendship`, см. schema.prisma) — `sendRequest`/`acceptRequest`/
 * `respondToRequest`. Сама `Friendship` — симметричная строка без
 * направления, `userAId` всегда < `userBId`.
 */
@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceService: PresenceService,
  ) {}

  async list(currentUserId: string): Promise<FriendDto[]> {
    const friendIds = await this.getFriendIds(currentUserId);
    if (friendIds.length === 0) return [];

    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ userAId: currentUserId }, { userBId: currentUserId }],
      },
      include: { userA: true, userB: true },
    });

    const onlineIds = await this.presenceService.filterOnline(friendIds);

    return Promise.all(
      friendships.map(async (friendship) => {
        const friend = friendship.userAId === currentUserId ? friendship.userB : friendship.userA;
        const mutualFriendsCount = await this.countMutualFriends(currentUserId, friend.id);

        return {
          id: friend.id,
          name: friend.name,
          tagline: friend.tagline,
          city: friend.city,
          about: friend.about,
          tags: friend.tags,
          isHere: onlineIds.has(friend.id),
          friendsSince: friendship.createdAt.toISOString(),
          mutualFriendsCount,
        } satisfies FriendDto;
      }),
    );
  }

  async sendRequest(senderId: string, receiverId: string): Promise<SendRequestResult> {
    if (senderId === receiverId) {
      throw new BadRequestException('Нельзя отправить заявку самому себе');
    }
    await this.assertUserExists(receiverId);

    const outcome = await this.runSendRequestWithRetry(senderId, receiverId);
    return { status: await this.getStatus(senderId, receiverId), outcome };
  }

  /**
   * Проверка встречной заявки + создание заявки/дружбы — цельная операция:
   * без неё две одновременные заявки друг другу (A→B и B→A в один момент)
   * обе видят «встречной заявки ещё нет» и создают по отдельной pending-
   * записи вместо мгновенной дружбы. `Serializable`-изоляция заставляет
   * Postgres сериализовать конкурирующие транзакции над одной парой
   * пользователей, откатывая одну из них — ловим конфликт (Prisma P2034) и
   * повторяем: проигравшая транзакция на повторной попытке уже увидит
   * результат выигравшей (либо готовую дружбу, либо встречную заявку).
   */
  private async runSendRequestWithRetry(
    senderId: string,
    receiverId: string,
  ): Promise<SendRequestResult['outcome']> {
    for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            if (await this.areFriends(tx, senderId, receiverId)) {
              return 'already-friends';
            }

            const reverseRequest = await tx.friendRequest.findUnique({
              where: { senderId_receiverId: { senderId: receiverId, receiverId: senderId } },
            });

            if (reverseRequest) {
              // Получатель уже отправил мне заявку — принимаем её, а не
              // заводим вторую в обратном направлении.
              await this.confirmFriendship(tx, senderId, receiverId, reverseRequest.id);
              return 'auto-accepted';
            }

            const created = await tx.friendRequest
              .create({ data: { senderId, receiverId } })
              .catch(() => null);
            return created ? 'request-created' : 'already-pending';
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        const isSerializationConflict =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!isSerializationConflict || attempt === MAX_SERIALIZATION_RETRIES - 1) {
          throw error;
        }
        const jitter = 0.5 + Math.random();
        await this.delay(RETRY_BASE_DELAY_MS * (attempt + 1) * jitter);
      }
    }
    // Недостижимо: цикл выше либо возвращает результат, либо бросает исключение.
    throw new Error('sendRequest: превышено число попыток при конфликте транзакции');
  }

  /** Отмена своей исходящей заявки или отклонение чужой входящей — одна и та же операция. */
  async respondToRequest(userId: string, otherUserId: string): Promise<RespondToRequestResult> {
    const deleted = await this.prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
    });
    return { status: await this.getStatus(userId, otherUserId), removed: deleted.count > 0 };
  }

  /** `findUnique` + `confirmFriendship` — в одной транзакции: если заявку
   * отменят/отклонят ровно между чтением и подтверждением (гонка с
   * `respondToRequest`), `delete` внутри `confirmFriendship` иначе упал бы
   * с P2025 (строка уже не существует) и отдал бы 500 вместо честного
   * «заявка не найдена». */
  async acceptRequest(currentUserId: string, senderId: string): Promise<FriendshipStatusDto> {
    await this.prisma.$transaction(async (tx) => {
      const request = await tx.friendRequest.findUnique({
        where: { senderId_receiverId: { senderId, receiverId: currentUserId } },
      });
      if (!request) {
        throw new NotFoundException('Заявка не найдена');
      }
      await this.confirmFriendship(tx, currentUserId, senderId, request.id);
    });
    return this.getStatus(currentUserId, senderId);
  }

  async listRequests(currentUserId: string): Promise<FriendRequestsListDto> {
    const [incoming, outgoing] = await Promise.all([
      this.prisma.friendRequest.findMany({
        where: { receiverId: currentUserId },
        include: { sender: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.friendRequest.findMany({
        where: { senderId: currentUserId },
        include: { receiver: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const toDto = (user: User, createdAt: Date): FriendRequestDto => ({
      user: toPublicProfile(user),
      createdAt: createdAt.toISOString(),
    });

    return {
      incoming: incoming.map((request) => toDto(request.sender, request.createdAt)),
      outgoing: outgoing.map((request) => toDto(request.receiver, request.createdAt)),
    };
  }

  async getStatus(currentUserId: string, otherUserId: string): Promise<FriendshipStatusDto> {
    const [isFriend, outgoing, incoming] = await Promise.all([
      this.areFriends(this.prisma, currentUserId, otherUserId),
      this.prisma.friendRequest.findUnique({
        where: { senderId_receiverId: { senderId: currentUserId, receiverId: otherUserId } },
        select: { id: true },
      }),
      this.prisma.friendRequest.findUnique({
        where: { senderId_receiverId: { senderId: otherUserId, receiverId: currentUserId } },
        select: { id: true },
      }),
    ]);

    return {
      isFriend,
      hasOutgoingRequest: Boolean(outgoing),
      hasIncomingRequest: Boolean(incoming),
    };
  }

  /** Принимает `PrismaService` либо клиент активной транзакции (`tx`) — так
   * `sendRequest` может проверить дружбу как часть одной сериализуемой
   * транзакции, а не отдельным запросом до неё. */
  private async areFriends(
    client: PrismaService | TransactionClient,
    userAId: string,
    userBId: string,
  ): Promise<boolean> {
    const [a, b] = [userAId, userBId].sort();
    const friendship = await client.friendship.findUnique({
      where: { userAId_userBId: { userAId: a, userBId: b } },
      select: { id: true },
    });
    return Boolean(friendship);
  }

  /** Удаляет заявку и создаёт симметричную дружбу — вызывается уже внутри
   * транзакции вызывающего кода (`sendRequest`/`acceptRequest`), не заводит
   * собственную: гонка «отменили заявку между чтением и подтверждением»
   * должна откатывать всю операцию целиком, а не только этот шаг. */
  private async confirmFriendship(
    tx: TransactionClient,
    userAId: string,
    userBId: string,
    requestId: string,
  ): Promise<void> {
    const [a, b] = [userAId, userBId].sort();
    await tx.friendRequest.delete({ where: { id: requestId } });
    await tx.friendship.create({ data: { userAId: a, userBId: b } }).catch(() => null);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async assertUserExists(userId: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Пользователь не найден');
    }
  }

  private async getFriendIds(userId: string): Promise<string[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      select: { userAId: true, userBId: true },
    });
    return friendships.map((friendship) =>
      friendship.userAId === userId ? friendship.userBId : friendship.userAId,
    );
  }

  private async countMutualFriends(userId: string, otherUserId: string): Promise<number> {
    const [myFriendIds, theirFriendIds] = await Promise.all([
      this.getFriendIds(userId),
      this.getFriendIds(otherUserId),
    ]);
    const theirSet = new Set(theirFriendIds);
    return myFriendIds.filter((id) => theirSet.has(id)).length;
  }
}
