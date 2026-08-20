import { Injectable, NotFoundException } from '@nestjs/common';
import type { Community, CommunityMembership } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { CommunityDto } from './communities.types';

type CommunityWithMemberships = Community & { memberships: CommunityMembership[] };

@Injectable()
export class CommunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(currentUserId: string): Promise<CommunityDto[]> {
    const communities = await this.prisma.community.findMany({
      orderBy: { name: 'asc' },
      include: { memberships: { where: { userId: currentUserId } } },
    });
    return communities.map((community) => this.toDto(community));
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
