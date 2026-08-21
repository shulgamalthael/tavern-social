import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Group, GroupJoinRequest, GroupMembership } from '@prisma/client';
import { deleteUploadedFile } from '@/common/lib/upload';
import type { PaginatedDto } from '@/common/types/paginated';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { toPublicProfile } from '@/modules/users/users.mapper';
import type { CreateGroupDto } from './dto/create-group.dto';
import type { UpdateGroupDto } from './dto/update-group.dto';
import type { GroupDto, GroupJoinRequestDto, GroupMemberDto } from './groups.types';

/** Тот же лимит по умолчанию, что и у остальных курсорных списков (см.
 * `CommunitiesService`/`NotificationsService`). */
const DEFAULT_GROUPS_LIMIT = 20;
/** Рекомендация задачи для списка участников/заявок группы. */
const DEFAULT_GROUP_MEMBERS_LIMIT = 20;

type GroupWithCurrentUser = Group & {
  memberships: GroupMembership[];
  joinRequests: GroupJoinRequest[];
};

/**
 * Группы — каталог виден всем (в т.ч. приватные, по названию/описанию), но
 * доступ к контенту (лента/участники) приватной группы есть только у
 * участников — см. `assertCanViewContent`. Роль владельца — не отдельное
 * поле, а `GroupMembership.role === 'owner'`, ровно одна на группу
 * (создатель при `create`, передачи владения нет — см. AGENTS.md/план).
 */
@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    currentUserId: string,
    cursor?: string,
    limit = DEFAULT_GROUPS_LIMIT,
  ): Promise<PaginatedDto<GroupDto>> {
    const groups = await this.prisma.group.findMany({
      // `id` вторым полем — `name` не уникально (см. CommunitiesService.list).
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: this.currentUserInclude(currentUserId),
    });

    const hasMore = groups.length > limit;
    const page = hasMore ? groups.slice(0, limit) : groups;
    return {
      items: page.map((group) => this.toDto(group)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async getOne(groupId: string, currentUserId: string): Promise<GroupDto> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: this.currentUserInclude(currentUserId),
    });
    if (!group) {
      throw new NotFoundException('Группа не найдена');
    }
    return this.toDto(group);
  }

  async create(userId: string, dto: CreateGroupDto): Promise<GroupDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: dto.name,
          description: dto.description ?? '',
          type: dto.type,
          membersCount: 1,
        },
      });
      await tx.groupMembership.create({ data: { groupId: group.id, userId, role: 'owner' } });
      return group;
    });
    return this.getOne(created.id, userId);
  }

  async update(groupId: string, userId: string, dto: UpdateGroupDto): Promise<GroupDto> {
    await this.assertOwner(groupId, userId);
    await this.prisma.group.update({
      where: { id: groupId },
      data: {
        // Частичное обновление — undefined значит «поле не пришло», не «очистить».
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
      },
    });
    return this.getOne(groupId, userId);
  }

  async setAvatar(groupId: string, userId: string, url: string): Promise<GroupDto> {
    await this.assertOwner(groupId, userId);
    const group = await this.prisma.group.findUniqueOrThrow({ where: { id: groupId } });
    deleteUploadedFile(group.avatarUrl);
    await this.prisma.group.update({ where: { id: groupId }, data: { avatarUrl: url } });
    return this.getOne(groupId, userId);
  }

  async setCover(groupId: string, userId: string, url: string): Promise<GroupDto> {
    await this.assertOwner(groupId, userId);
    const group = await this.prisma.group.findUniqueOrThrow({ where: { id: groupId } });
    deleteUploadedFile(group.coverUrl);
    await this.prisma.group.update({ where: { id: groupId }, data: { coverUrl: url } });
    return this.getOne(groupId, userId);
  }

  /** Мгновенное вступление — только для открытых групп; приватные требуют
   * заявку (см. `requestJoin`). */
  async join(groupId: string, userId: string): Promise<GroupDto> {
    const group = await this.assertExists(groupId);
    if (group.type === 'private') {
      throw new BadRequestException('Группа приватная — нужно отправить запрос на вступление');
    }

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.groupMembership
        .create({ data: { groupId, userId, role: 'member' } })
        .catch(() => null);
      if (created) {
        await tx.group.update({ where: { id: groupId }, data: { membersCount: { increment: 1 } } });
      }
    });

    return this.getOne(groupId, userId);
  }

  async leave(groupId: string, userId: string): Promise<GroupDto> {
    await this.assertExists(groupId);
    const membership = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (membership?.role === 'owner') {
      throw new BadRequestException('Владелец не может покинуть свою группу');
    }

    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.groupMembership.deleteMany({ where: { groupId, userId } });
      if (deleted.count > 0) {
        await tx.group.update({ where: { id: groupId }, data: { membersCount: { decrement: 1 } } });
      }
    });

    return this.getOne(groupId, userId);
  }

  /** Заявка на вступление в приватную группу — `ownerId` в результате нужен
   * контроллеру только для уведомления (сам сервис ничего не знает про
   * Socket.IO/NotificationsService, см. AGENTS.md backend). */
  async requestJoin(
    groupId: string,
    userId: string,
  ): Promise<{ group: GroupDto; ownerId: string; created: boolean }> {
    const group = await this.assertExists(groupId);
    if (group.type !== 'private') {
      throw new BadRequestException('У открытой группы нет заявок — вступите напрямую');
    }
    const membership = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (membership) {
      throw new BadRequestException('Вы уже участник этой группы');
    }

    const created = await this.prisma.groupJoinRequest
      .create({ data: { groupId, userId } })
      .catch(() => null);
    const owner = await this.prisma.groupMembership.findFirstOrThrow({
      where: { groupId, role: 'owner' },
      select: { userId: true },
    });

    return {
      group: await this.getOne(groupId, userId),
      ownerId: owner.userId,
      created: Boolean(created),
    };
  }

  async listJoinRequests(
    groupId: string,
    ownerId: string,
    cursor?: string,
    limit = DEFAULT_GROUP_MEMBERS_LIMIT,
  ): Promise<PaginatedDto<GroupJoinRequestDto>> {
    await this.assertOwner(groupId, ownerId);

    const requests = await this.prisma.groupJoinRequest.findMany({
      where: { groupId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: true },
    });

    const hasMore = requests.length > limit;
    const page = hasMore ? requests.slice(0, limit) : requests;
    return {
      items: page.map((request) => ({
        user: toPublicProfile(request.user),
        createdAt: request.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /** Одобрение — заявка удаляется и заменяется членством в одной транзакции
   * (тот же паттерн, что `FriendsService.confirmFriendship`), без истории. */
  async approveJoinRequest(groupId: string, ownerId: string, targetUserId: string): Promise<void> {
    await this.assertOwner(groupId, ownerId);

    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.groupJoinRequest.deleteMany({
        where: { groupId, userId: targetUserId },
      });
      if (deleted.count === 0) {
        throw new NotFoundException('Заявка не найдена');
      }
      const created = await tx.groupMembership
        .create({ data: { groupId, userId: targetUserId, role: 'member' } })
        .catch(() => null);
      if (created) {
        await tx.group.update({ where: { id: groupId }, data: { membersCount: { increment: 1 } } });
      }
    });
  }

  /** Отклонение не уведомляет — тот же принцип, что и у отклонённой
   * `FriendRequest` (см. план, §7). */
  async rejectJoinRequest(groupId: string, ownerId: string, targetUserId: string): Promise<void> {
    await this.assertOwner(groupId, ownerId);
    const deleted = await this.prisma.groupJoinRequest.deleteMany({
      where: { groupId, userId: targetUserId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Заявка не найдена');
    }
  }

  async listMembers(
    groupId: string,
    currentUserId: string,
    cursor?: string,
    limit = DEFAULT_GROUP_MEMBERS_LIMIT,
  ): Promise<PaginatedDto<GroupMemberDto>> {
    await this.assertCanViewContent(groupId, currentUserId);

    const memberships = await this.prisma.groupMembership.findMany({
      where: { groupId },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: true },
    });

    const hasMore = memberships.length > limit;
    const page = hasMore ? memberships.slice(0, limit) : memberships;
    return {
      items: page.map((membership) => ({
        user: toPublicProfile(membership.user),
        role: membership.role,
        joinedAt: membership.joinedAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async removeMember(groupId: string, ownerId: string, targetUserId: string): Promise<void> {
    await this.assertOwner(groupId, ownerId);
    const membership = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    if (!membership) {
      throw new NotFoundException('Участник не найден');
    }
    if (membership.role === 'owner') {
      throw new BadRequestException('Нельзя удалить владельца группы');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupMembership.delete({ where: { id: membership.id } });
      await tx.group.update({ where: { id: groupId }, data: { membersCount: { decrement: 1 } } });
    });
  }

  /** Доступ к контенту приватной группы — 403, не 404: существование самой
   * группы публично (каталог/поиск), не подтверждается только контент внутри
   * (см. план, §5). Не экспортируется за пределы модуля напрямую — `PostsService`
   * делает собственную (raw Prisma) проверку членства, чтобы избежать
   * циклической зависимости модулей (`GroupsModule` импортирует `PostsModule`,
   * не наоборот).
   */
  private async assertCanViewContent(groupId: string, userId: string): Promise<void> {
    const group = await this.assertExists(groupId);
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

  private async assertOwner(groupId: string, userId: string): Promise<void> {
    const membership = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership || membership.role !== 'owner') {
      throw new ForbiddenException('Действие доступно только владельцу группы');
    }
  }

  private async assertExists(groupId: string): Promise<Group> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Группа не найдена');
    }
    return group;
  }

  private currentUserInclude(currentUserId: string) {
    return {
      memberships: { where: { userId: currentUserId } },
      joinRequests: { where: { userId: currentUserId } },
    } as const;
  }

  private toDto(group: GroupWithCurrentUser): GroupDto {
    const membership = group.memberships[0] ?? null;
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      type: group.type,
      avatarUrl: group.avatarUrl,
      coverUrl: group.coverUrl,
      membersCount: group.membersCount,
      currentUserRole: membership?.role ?? null,
      hasPendingJoinRequest: group.joinRequests.length > 0,
      canViewContent: group.type === 'open' || Boolean(membership),
    };
  }
}
