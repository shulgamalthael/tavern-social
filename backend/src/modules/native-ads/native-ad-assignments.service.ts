import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { rankCreatorMatches, type CreatorMatchProfile } from './lib/creator-matching.lib';
import {
  toNativeAdAssignmentDto,
  type CreatorNativeAdDto,
  type NativeAdAssignmentDto,
  type RecommendedCreatorDto,
} from './native-ads.types';

/** Сколько рекомендаций показывать админу за раз — тот же принцип, что и у
 * любого другого "топ-N" списка в проекте (не весь возможный список
 * активных creator'ов, только те, что реально стоит рассмотреть первыми). */
const MAX_RECOMMENDATIONS = 20;

/** Компактная строка выбора creator'а при ручном назначении (см.
 * `AssignCreatorDto`) — намеренно НЕ `AdminCreatorListItemDto` (`creators`
 * module): та отдаёт полный `PublicProfile`, здесь нужен только id/имя/
 * аватар/категория для UI-пикера, раздувать запрос лишними полями незачем. */
export interface EligibleCreatorDto {
  creatorProfileId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  primaryCategory: string | null;
}

const ASSIGNMENT_INCLUDE = {
  creatorProfile: { include: { user: { select: { name: true, avatarUrl: true } } } },
} as const;

/**
 * "Manual creator↔campaign assignment only — no AI yet" (Creator
 * Monetization Phase 2, корневой план фичи) — админ вручную решает, какие
 * активные creator'ы получают показы конкретной кампании.
 * `targetCategoryIds`/`targetGeography` кампании — подсказка при выборе, не
 * критерий: реальный AI-подбор — Phase 3, эта таблица переживёт его без
 * изменений (движок ленты читает только назначения, не то, КАК они возникли).
 */
@Injectable()
export class NativeAdAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCampaign(campaignId: string): Promise<NativeAdAssignmentDto[]> {
    const assignments = await this.prisma.nativeAdAssignment.findMany({
      where: { campaignId },
      include: ASSIGNMENT_INCLUDE,
      orderBy: { assignedAt: 'desc' },
    });
    return assignments.map(toNativeAdAssignmentDto);
  }

  /** Только активные creator'ы (`CreatorStatus.active`) — компактный вид для
   * UI-пикера при ручном назначении, не полный `AdminCreatorListItemDto`
   * (`creators` module) — см. `EligibleCreatorDto`'s комментарий. Прямой
   * Prisma-запрос, не импорт `CreatorsService`, — независимость модулей
   * друг от друга, оба ссылаются только на `CreatorProfile`. */
  async listEligibleCreators(): Promise<EligibleCreatorDto[]> {
    const profiles = await this.prisma.creatorProfile.findMany({
      where: { status: 'active' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        categories: { where: { isPrimary: true }, include: { category: true } },
      },
      orderBy: { activatedAt: 'desc' },
    });
    return profiles.map((profile) => ({
      creatorProfileId: profile.id,
      userId: profile.user.id,
      name: profile.user.name,
      avatarUrl: profile.user.avatarUrl,
      primaryCategory: profile.categories[0]?.category.label ?? null,
    }));
  }

  /** Ранжированная подсказка для ручного назначения (Creator Monetization
   * Phase 3, AI_PLATFORM_ROADMAP.md §81) — см. `lib/creator-matching.lib.ts`'s
   * комментарий про детерминированный, а не LLM, скоринг. Не ограничивает,
   * КОГО можно назначить (`assign` ниже по-прежнему принимает любой активный
   * `creatorProfileId`) — только помогает найти, с кого начинать смотреть. */
  async listRecommendedCreators(campaignId: string): Promise<RecommendedCreatorDto[]> {
    const campaign = await this.prisma.nativeAdCampaign.findUnique({
      where: { id: campaignId },
      select: { targetCategoryIds: true, targetGeography: true },
    });
    if (!campaign) throw new NotFoundException('Кампания не найдена');

    const profiles = await this.prisma.creatorProfile.findMany({
      where: { status: 'active' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, city: true } },
        categories: { include: { category: true } },
      },
    });
    if (profiles.length === 0) return [];

    // N+1 `count()` на активного creator'а — приемлемо здесь: это
    // редкий admin-only просмотр (не горячий путь показа рекламы, см.
    // `NativeAdFeedService`'s Redis-less обоснование по той же причине),
    // а не публичная доставка на каждый рендер ленты. Аудитория — друзья
    // ПЛЮС подписчики (§85: оба — реальные каналы трафика creator'а,
    // `PostsService.listFeed`), простая сумма без дедупликации человека,
    // который одновременно и друг, и подписчик — это мягкая
    // ранжирующая подсказка админу, не финансовый расчёт, где важна точность.
    const [friendCounts, followerCounts] = await Promise.all([
      Promise.all(
        profiles.map((profile) =>
          this.prisma.friendship.count({
            where: { OR: [{ userAId: profile.user.id }, { userBId: profile.user.id }] },
          }),
        ),
      ),
      Promise.all(
        profiles.map((profile) =>
          this.prisma.subscription.count({ where: { followingId: profile.user.id } }),
        ),
      ),
    ]);

    const matchProfiles: CreatorMatchProfile[] = profiles.map((profile, index) => ({
      creatorProfileId: profile.id,
      categoryIds: profile.categories.map((assignment) => assignment.categoryId),
      primaryCategoryId:
        profile.categories.find((assignment) => assignment.isPrimary)?.categoryId ?? null,
      city: profile.user.city,
      audienceSize: friendCounts[index] + followerCounts[index],
    }));

    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const primaryLabelById = new Map(
      profiles.map((profile) => [
        profile.id,
        profile.categories.find((assignment) => assignment.isPrimary)?.category.label ?? null,
      ]),
    );

    return rankCreatorMatches(campaign, matchProfiles)
      .slice(0, MAX_RECOMMENDATIONS)
      .map((match) => {
        const profile = profileById.get(match.creatorProfileId)!;
        return {
          creatorProfileId: match.creatorProfileId,
          name: profile.user.name,
          avatarUrl: profile.user.avatarUrl,
          primaryCategory: primaryLabelById.get(match.creatorProfileId) ?? null,
          matchPercent: match.matchPercent,
          reasons: match.reasons,
        };
      });
  }

  async assign(campaignId: string, creatorProfileId: string): Promise<NativeAdAssignmentDto> {
    const [campaign, creator] = await Promise.all([
      this.prisma.nativeAdCampaign.findUnique({ where: { id: campaignId } }),
      this.prisma.creatorProfile.findUnique({ where: { id: creatorProfileId } }),
    ]);
    if (!campaign) throw new NotFoundException('Кампания не найдена');
    if (!creator) throw new NotFoundException('Creator не найден');
    if (creator.status !== 'active') {
      throw new BadRequestException('Назначать можно только на активного creator’а');
    }

    const assignment = await this.prisma.nativeAdAssignment.upsert({
      where: { campaignId_creatorProfileId: { campaignId, creatorProfileId } },
      create: { campaignId, creatorProfileId },
      update: { status: 'active' },
      include: ASSIGNMENT_INCLUDE,
    });
    return toNativeAdAssignmentDto(assignment);
  }

  async unassign(campaignId: string, creatorProfileId: string): Promise<void> {
    await this.prisma.nativeAdAssignment.deleteMany({
      where: { campaignId, creatorProfileId },
    });
  }

  /** Для Creator Studio → «Реклама» (`NativeAdFeedController.myAssignments`)
   * — только назначения САМОГО creator'а, по `userId` из сессии (не по
   * `creatorProfileId`, чтобы вызывающему контроллеру не нужно было отдельно
   * резолвить профиль). Пусто, если у пользователя ещё нет `CreatorProfile`
   * — не ошибка, тот же принцип, что `CreatorsService.getMyProfile`. */
  async listForCreatorUser(userId: string): Promise<CreatorNativeAdDto[]> {
    const creator = await this.prisma.creatorProfile.findUnique({ where: { userId } });
    if (!creator) return [];

    const assignments = await this.prisma.nativeAdAssignment.findMany({
      where: { creatorProfileId: creator.id, status: 'active' },
      include: {
        campaign: {
          include: {
            creatives: { where: { status: 'approved' } },
            advertiserBusiness: { select: { name: true } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    const items: CreatorNativeAdDto[] = [];
    for (const assignment of assignments) {
      const creative = assignment.campaign.creatives[0];
      if (!creative) continue;
      items.push({
        assignmentId: assignment.id,
        sponsorName: assignment.campaign.advertiserBusiness.name,
        style: creative.style,
        headline: creative.headline,
        imageUrl: creative.imageUrl,
        status: assignment.status,
      });
    }
    return items;
  }
}
