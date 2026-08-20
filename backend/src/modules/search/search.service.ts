import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { UsersService } from '@/modules/users/users.service';
import type { SearchCommunityDto, SearchGroupDto, SearchResultDto } from './search.types';

const DEFAULT_LIMIT = 5;

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async search(currentUserId: string, q: string, limit = DEFAULT_LIMIT): Promise<SearchResultDto> {
    const [users, groups, communities] = await Promise.all([
      this.searchUsers(q, limit),
      this.searchGroups(currentUserId, q, limit),
      this.searchCommunities(currentUserId, q, limit),
    ]);

    return { users, groups, communities };
  }

  private async searchUsers(q: string, limit: number) {
    const users = await this.prisma.user.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      orderBy: { name: 'asc' },
      take: limit,
    });
    return users.map((user) => this.usersService.toPublicProfile(user));
  }

  /**
   * Группы закрытые, «только по приглашению» — вступления/публичного каталога
   * нет (см. GroupsService). Поэтому поиск ищет только среди групп, в которых
   * текущий пользователь уже состоит, а не по всем группам системы — иначе
   * он находил бы группы, вступить в которые всё равно невозможно.
   */
  private async searchGroups(
    currentUserId: string,
    q: string,
    limit: number,
  ): Promise<SearchGroupDto[]> {
    const memberships = await this.prisma.groupMembership.findMany({
      where: { userId: currentUserId, group: { name: { contains: q, mode: 'insensitive' } } },
      include: { group: true },
      orderBy: { group: { name: 'asc' } },
      take: limit,
    });

    return memberships.map((membership) => ({
      id: membership.group.id,
      name: membership.group.name,
      meta: membership.group.meta,
      mark: membership.group.mark,
    }));
  }

  private async searchCommunities(
    currentUserId: string,
    q: string,
    limit: number,
  ): Promise<SearchCommunityDto[]> {
    const communities = await this.prisma.community.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { about: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { memberships: { where: { userId: currentUserId } } },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return communities.map((community) => ({
      id: community.id,
      name: community.name,
      about: community.about,
      cover: community.cover,
      membersCount: community.membersCount,
      isJoined: community.memberships.length > 0,
    }));
  }
}
