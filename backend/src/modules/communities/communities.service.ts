import { Injectable, NotFoundException } from '@nestjs/common';
import type { Community, CommunityMembership } from '@prisma/client';
import type { PaginatedDto } from '@/common/types/paginated';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { CommunityDto } from './communities.types';

type CommunityWithMemberships = Community & { memberships: CommunityMembership[] };

/** Тот же лимит по умолчанию, что и у остальных курсорных списков (см.
 * `NotificationsService`) — витрина открытых сообществ листается точно так же. */
const DEFAULT_COMMUNITIES_LIMIT = 20;

@Injectable()
export class CommunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    currentUserId: string,
    cursor?: string,
    limit = DEFAULT_COMMUNITIES_LIMIT,
  ): Promise<PaginatedDto<CommunityDto>> {
    const communities = await this.prisma.community.findMany({
      // `id` вторым полем — `name` не уникально, курсор без стабильного
      // полного порядка мог бы пропускать/дублировать строки на совпадающих
      // именах при перелистывании.
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { memberships: { where: { userId: currentUserId } } },
    });

    const hasMore = communities.length > limit;
    const page = hasMore ? communities.slice(0, limit) : communities;
    return {
      items: page.map((community) => this.toDto(community)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async join(communityId: string, userId: string): Promise<CommunityDto> {
    await this.assertExists(communityId);

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.communityMembership
        .create({ data: { communityId, userId } })
        .catch(() => null);
      if (created) {
        await tx.community.update({
          where: { id: communityId },
          data: { membersCount: { increment: 1 } },
        });
      }
    });

    return this.getOneForUser(communityId, userId);
  }

  async leave(communityId: string, userId: string): Promise<CommunityDto> {
    await this.assertExists(communityId);

    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.communityMembership.deleteMany({
        where: { communityId, userId },
      });
      if (deleted.count > 0) {
        await tx.community.update({
          where: { id: communityId },
          data: { membersCount: { decrement: 1 } },
        });
      }
    });

    return this.getOneForUser(communityId, userId);
  }

  /** Тот же приём, что `FriendsService.getFriendIds` — `PostsService.
   * listFeed` использует его для relationship-based фильтра главной ленты
   * (AI_PLATFORM_ROADMAP.md §73): пост в сообществе виден только его
   * участникам, не всем подряд. */
  async getMemberCommunityIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.communityMembership.findMany({
      where: { userId },
      select: { communityId: true },
    });
    return memberships.map((membership) => membership.communityId);
  }

  private async assertExists(communityId: string): Promise<void> {
    const exists = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Сообщество не найдено');
    }
  }

  private async getOneForUser(communityId: string, userId: string): Promise<CommunityDto> {
    const community = await this.prisma.community.findUniqueOrThrow({
      where: { id: communityId },
      include: { memberships: { where: { userId } } },
    });
    return this.toDto(community);
  }

  private toDto(community: CommunityWithMemberships): CommunityDto {
    return {
      id: community.id,
      name: community.name,
      about: community.about,
      cover: community.cover,
      membersCount: community.membersCount,
      isJoined: community.memberships.length > 0,
    };
  }
}
