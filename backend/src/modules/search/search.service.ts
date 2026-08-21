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

  /** Каталог групп публичен (см. SearchGroupDto) — тот же паттерн, что и у
   * `searchCommunities` ниже, группы просто дополнительно ищутся по
   * описанию, не только по имени. */
  private async searchGroups(
    currentUserId: string,
    q: string,
    limit: number,
  ): Promise<SearchGroupDto[]> {
    const groups = await this.prisma.group.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { memberships: { where: { userId: currentUserId } } },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      type: group.type,
      avatarUrl: group.avatarUrl,
      membersCount: group.membersCount,
      isMember: group.memberships.length > 0,
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
