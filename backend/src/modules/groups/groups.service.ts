import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { GroupDto } from './groups.types';

/**
 * Группы — закрытые, «только по приглашению» (см. widgets/groups на frontend):
 * список отдаёт только группы, участником которых пользователь уже является.
 * Вступление/создание группы на frontend нет — соответствующих endpoint'ов нет.
 */
@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<GroupDto[]> {
    const memberships = await this.prisma.groupMembership.findMany({
      where: { userId },
      include: { group: true },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((membership) => ({
      id: membership.group.id,
      name: membership.group.name,
      meta: membership.group.meta,
      mark: membership.group.mark,
      role: membership.role,
    }));
  }
}
