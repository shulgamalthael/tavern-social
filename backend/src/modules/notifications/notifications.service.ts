import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Notification, NotificationType, User } from '@prisma/client';
import { extractImageUrls } from '@/common/lib/post-image-placeholders';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { toPublicProfile } from '@/modules/users/users.mapper';
import type { PublicProfile } from '@/modules/users/users.types';
import type {
  BusinessNotificationDto,
  NotificationDto,
  NotificationsListDto,
} from './notifications.types';

const DEFAULT_LIMIT = 20;
/** Максимум строк в бизнес-notifications фиде (`listForBusiness` ниже) — тот
 * же фиксированный лимит без пагинации, что `AuditLogService.listForBusiness`
 * (AI-3, §10.7): "мини" по масштабу этой фичи, не полноценная лента с
 * курсорами. */
const BUSINESS_FEED_LIMIT = 30;
/** `rule_triggered` (Business Logic Engine, AI-5) намеренно исключён из
 * общей социальной ленты `/notifications` — в отличие от всех остальных
 * типов, у него нет `actor` (см. `Notification.actorId`'s комментарий в
 * схеме), а фронтенд (`entities/notification/ui/NotificationItem.tsx`,
 * `model/types.ts`) сегодня везде обращается к `notification.actor.name`/
 * `.avatarUrl` безусловно — реальный краш, не гипотетический, если такое
 * уведомление попадёт в общий список без доработки того рендера. Строка в
 * БД при этом создаётся полноценно (см. `notifyRuleTriggered` ниже) —
 * исключена только из ЭТИХ двух read-путей, не из записи; отдельный
 * business-notifications экран (`listForBusiness`/`GET /businesses/
 * :businessId/notifications`, §15.4) читает те же строки напрямую. */
const FEED_EXCLUDED_TYPES: NotificationType[] = ['rule_triggered'];
const MAX_RECENT_ACTORS = 3;
/** Сколько раз повторить транзакцию при конфликте сериализации (Postgres
 * код 40001 / Prisma P2034) — параллельные лайки на один пост случаются
 * регулярно, retry должен покрывать реалистичный всплеск, не зависать. */
const MAX_SERIALIZATION_RETRIES = 8;
/** Базовая пауза перед повтором (мс) — растёт с номером попытки и берётся со
 * случайным джиттером, иначе все проигравшие транзакции просыпаются в один
 * и тот же момент и снова сталкиваются друг с другом (проверено нагрузочным
 * тестом: 8 параллельных лайков на один пост без джиттера давали 500-ку). */
const RETRY_BASE_DELAY_MS = 15;

type NotificationWithRelations = Notification & {
  /// `null` только для `rule_triggered` (см. `Notification.actorId`'s
  /// комментарий в схеме) — `list()` уже фильтрует такие строки через
  /// `FEED_EXCLUDED_TYPES`, поэтому `toDto` ниже вправе считать `null` здесь
  /// нарушенным инвариантом, а не штатным случаем (см. её собственную
  /// проверку).
  actor: User | null;
  post: { id: string; text: string } | null;
  comment: { text: string } | null;
  group: { id: string; name: string } | null;
};

const LIST_INCLUDE = {
  actor: true,
  post: { select: { id: true, text: true } },
  comment: { select: { text: true } },
  group: { select: { id: true, name: true } },
} as const;

export interface NotifyPostInteractionParams {
  type: Extract<NotificationType, 'post_like' | 'post_comment' | 'post_repost'>;
  recipientId: string;
  actorId: string;
  postId: string;
  commentId?: string;
}

/**
 * Единственное место, которое пишет в таблицу `notifications` — вызывается
 * из `PostsController`/`FriendsController` ПОСЛЕ основной бизнес-логики
 * (лайк/комментарий/репост/заявка уже сохранены), сама ничего не знает про
 * Socket.IO — эмиссию решает контроллер (см. AGENTS.md backend).
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notifyFriendRequest(
    recipientId: string,
    actorId: string,
  ): Promise<{ id: string; actor: PublicProfile }> {
    const notification = await this.prisma.notification.create({
      data: { recipientId, actorId, type: 'friend_request', recentActorIds: [actorId] },
      select: { id: true, actor: true },
    });
    // `actorId` выше — обязательный параметр этого метода, `actor` в ответе
    // Prisma гарантированно не `null` (nullable он только для `rule_triggered`,
    // см. `NotificationWithRelations`'s комментарий).
    return { id: notification.id, actor: toPublicProfile(notification.actor!) };
  }

  async notifyFriendAccepted(
    recipientId: string,
    actorId: string,
  ): Promise<{ id: string; actor: PublicProfile }> {
    const notification = await this.prisma.notification.create({
      data: { recipientId, actorId, type: 'friend_accepted', recentActorIds: [actorId] },
      select: { id: true, actor: true },
    });
    // См. `notifyFriendRequest`'s комментарий — `actor` здесь тоже
    // гарантированно не `null`.
    return { id: notification.id, actor: toPublicProfile(notification.actor!) };
  }

  async notifyGroupJoinRequest(
    recipientId: string,
    actorId: string,
    groupId: string,
  ): Promise<{ id: string; actor: PublicProfile }> {
    const notification = await this.prisma.notification.create({
      data: {
        recipientId,
        actorId,
        type: 'group_join_request',
        groupId,
        recentActorIds: [actorId],
      },
      select: { id: true, actor: true },
    });
    // См. `notifyFriendRequest`'s комментарий — `actor` здесь тоже
    // гарантированно не `null`.
    return { id: notification.id, actor: toPublicProfile(notification.actor!) };
  }

  async notifyGroupJoinAccepted(
    recipientId: string,
    actorId: string,
    groupId: string,
  ): Promise<{ id: string; actor: PublicProfile }> {
    const notification = await this.prisma.notification.create({
      data: {
        recipientId,
        actorId,
        type: 'group_join_accepted',
        groupId,
        recentActorIds: [actorId],
      },
      select: { id: true, actor: true },
    });
    // См. `notifyFriendRequest`'s комментарий — `actor` здесь тоже
    // гарантированно не `null`.
    return { id: notification.id, actor: toPublicProfile(notification.actor!) };
  }

  /**
   * `post_like`/`post_repost`: пока по этому посту у получателя есть
   * непрочитанное уведомление того же типа — обновляем его (actorCount++,
   * актёр становится самым свежим в `recentActorIds`), а не плодим новые
   * строки на каждый лайк. `post_comment` группировки не имеет — у каждого
   * комментария свой уникальный текст, схлопывать нечего.
   *
   * Найти-и-обновить (`findFirst` → вычислить `recentActorIds` → `update`)
   * без блокировки строки — классический read-modify-write race: если два
   * лайка на один пост приходят одновременно, обе транзакции могут прочитать
   * одинаковый снэпшот `existing` до того, как другая запишет свой `update`,
   * и потерять часть `recentActorIds` (или в худшем случае обе решат, что
   * строки ещё нет, и создать дубликат). `Serializable`-изоляция заставляет
   * Postgres обнаружить такой конфликт и откатить одну из транзакций —
   * ловим это (Prisma P2034) и повторяем всю транзакцию заново.
   */
  async notifyPostInteraction(
    params: NotifyPostInteractionParams,
  ): Promise<{ id: string; actorCount: number; actor: PublicProfile; isNew: boolean }> {
    for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
        return await this.runNotifyPostInteraction(params);
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
    throw new Error('notifyPostInteraction: превышено число попыток при конфликте транзакции');
  }

  private async runNotifyPostInteraction(
    params: NotifyPostInteractionParams,
  ): Promise<{ id: string; actorCount: number; actor: PublicProfile; isNew: boolean }> {
    const { type, recipientId, actorId, postId, commentId } = params;

    return this.prisma.$transaction(
      async (tx) => {
        if (type !== 'post_comment') {
          const existing = await tx.notification.findFirst({
            where: { recipientId, type, postId, isRead: false },
          });
          if (existing) {
            const recentActorIds = [
              actorId,
              ...existing.recentActorIds.filter((id) => id !== actorId),
            ].slice(0, MAX_RECENT_ACTORS);
            const updated = await tx.notification.update({
              where: { id: existing.id },
              data: { actorCount: { increment: 1 }, recentActorIds, actorId },
              select: { id: true, actorCount: true, actor: true },
            });
            // `actorId` — обязательный параметр `NotifyPostInteractionParams`,
            // `actor` здесь тоже гарантированно не `null` (см.
            // `notifyFriendRequest`'s комментарий).
            return {
              id: updated.id,
              actorCount: updated.actorCount,
              actor: toPublicProfile(updated.actor!),
              isNew: false,
            };
          }
        }

        const created = await tx.notification.create({
          data: { recipientId, actorId, type, postId, commentId, recentActorIds: [actorId] },
          select: { id: true, actorCount: true, actor: true },
        });
        // См. `notifyFriendRequest`'s комментарий — `actor` здесь тоже
        // гарантированно не `null`.
        return {
          id: created.id,
          actorCount: created.actorCount,
          actor: toPublicProfile(created.actor!),
          isNew: true,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async list(
    userId: string,
    cursor?: string,
    limit = DEFAULT_LIMIT,
  ): Promise<NotificationsListDto> {
    const rows = await this.prisma.notification.findMany({
      where: { recipientId: userId, type: { notIn: FEED_EXCLUDED_TYPES } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: LIST_INCLUDE,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const actorProfiles = await this.resolveRecentActors(page);

    return {
      items: page.map((notification) => this.toDto(notification, actorProfiles)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { recipientId: userId, isRead: false, type: { notIn: FEED_EXCLUDED_TYPES } },
    });
  }

  /** Business Logic Engine v1 (AI-5, `send_notification`-действие правила,
   * см. `RulesService.runActions`) — единственный сегодня вызывающий,
   * `recipientId` — владелец бизнеса (`Business.ownerId`), не участник
   * социального графа. `actorId: null`/`recentActorIds: []` — у события нет
   * человека-инициатора (см. `Notification.actorId`'s комментарий в схеме).
   * `businessId`/`summary` (добавлены §15.4) — что показать в бизнес-
   * notifications экране (`listForBusiness` ниже); `RulesService` строит
   * `summary` из контекста триггера, эта строка его не интерпретирует.
   * Строка создаётся полноценно даже притом, что общий `/notifications`
   * фид её сегодня не показывает (см. `FEED_EXCLUDED_TYPES`) — история не
   * теряется, просто читается другим экраном. */
  async notifyRuleTriggered(
    recipientId: string,
    businessId: string,
    summary: string,
  ): Promise<{ id: string }> {
    const notification = await this.prisma.notification.create({
      data: { recipientId, type: 'rule_triggered', actorId: null, businessId, summary },
      select: { id: true },
    });
    return { id: notification.id };
  }

  /** Владелец-only — фид уведомлений Business Logic Engine ДЛЯ ОДНОГО
   * бизнеса (§15.4), в отличие от `list()` выше (вся социальная лента
   * пользователя сразу). `recipientId: ownerId` дублирует `businessId`-фильтр
   * по назначению (обе строки указывают на одного владельца в невырожденном
   * случае), но именно `recipientId` — реальная проверка владения (тот же
   * принцип, что `markRead`'s `updateMany`): без него чужой businessId в
   * URL с чужим `recipientId` тоже ничего не покажет, но с ним проверка не
   * зависит от того, что businessId вообще принадлежит вызывающему —
   * `assertOwnership` в контроллере уже это проверяет отдельно, это второй,
   * defense-in-depth рубеж, а не единственный. */
  async listForBusiness(businessId: string, ownerId: string): Promise<BusinessNotificationDto[]> {
    const rows = await this.prisma.notification.findMany({
      where: { businessId, recipientId: ownerId, type: 'rule_triggered' },
      orderBy: { createdAt: 'desc' },
      take: BUSINESS_FEED_LIMIT,
      select: { id: true, summary: true, isRead: true, createdAt: true },
    });
    return rows.map((row): BusinessNotificationDto => ({
      id: row.id,
      summary: row.summary ?? 'Событие автоматизации',
      isRead: row.isRead,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /** `updateMany` с фильтром по `recipientId` — заодно проверка владения,
   * чужое уведомление молча не тронется (0 затронутых строк). */
  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, recipientId: userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true },
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async resolveRecentActors(
    notifications: NotificationWithRelations[],
  ): Promise<Map<string, PublicProfile>> {
    const ids = new Set<string>();
    notifications.forEach((notification) =>
      notification.recentActorIds.forEach((id) => ids.add(id)),
    );
    if (ids.size === 0) return new Map();

    const users = await this.prisma.user.findMany({ where: { id: { in: [...ids] } } });
    return new Map(users.map((user) => [user.id, toPublicProfile(user)]));
  }

  private toDto(
    notification: NotificationWithRelations,
    actorProfiles: Map<string, PublicProfile>,
  ): NotificationDto {
    // `list()` уже фильтрует `rule_triggered` (единственный тип без actor,
    // см. `FEED_EXCLUDED_TYPES`) до того, как строки долетают сюда — `null`
    // здесь означает, что этот инвариант нарушен где-то выше, а не штатный
    // случай, который стоит тихо подставлять заглушкой.
    if (!notification.actor) {
      throw new Error(`Notification ${notification.id} (${notification.type}) не имеет actor`);
    }

    return {
      id: notification.id,
      type: notification.type,
      actor: toPublicProfile(notification.actor),
      actorCount: notification.actorCount,
      recentActors: notification.recentActorIds
        .map((id) => actorProfiles.get(id))
        .filter((profile): profile is PublicProfile => Boolean(profile)),
      post: notification.post
        ? {
            id: notification.post.id,
            text: notification.post.text,
            hasImage: extractImageUrls(notification.post.text).length > 0,
          }
        : null,
      commentText: notification.comment?.text ?? null,
      group: notification.group,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
