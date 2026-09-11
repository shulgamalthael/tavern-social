import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  isCandidateBlocked,
  selectPacedPostIds,
  type FeedCreatorContext,
} from './lib/native-ad-feed.lib';
import type { NativeAdFeedItemDto } from './native-ads.types';

interface EligibleCandidate {
  assignmentId: string;
  campaignId: string;
  creativeId: string;
  sponsorName: string;
  style: NativeAdFeedItemDto['style'];
  headline: string;
  bodyText: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  ctaLabel: string | null;
  targetUrl: string;
  advertiserBusinessId: string;
}

/**
 * Вставка нативной рекламы в ленту (Creator Monetization Phase 2,
 * AI_PLATFORM_ROADMAP.md §80) — НЕ переписывает `PostsService.listFeed`
 * (курсорная пагинация по `id`, см. её комментарий) и НЕ превращает
 * `entities/post`'s `Post[]` в дискриминированное объединение (см.
 * `post-store.ts` — `posts: Post[]` пронизывает полтора десятка методов
 * лайков/репостов/комментариев/стен/групп; тот же принцип "не строить
 * впрок", что и везде в проекте, применённый в обратную сторону — здесь
 * ПОТЕНЦИАЛЬНАЯ выгода дискриминированного объединения не стоит настолько
 * широкого blast radius). Вместо этого — тонкий ДОПОЛНИТЕЛЬНЫЙ эндпоинт
 * (`NativeAdFeedController.select`): клиент присылает id постов уже
 * загруженной страницы ленты, получает обратно карту "после какого поста
 * что вставить", и рендерит `NativeAdCard` рядом с `PostCard` чисто на
 * уровне отображения, не трогая сам `PostState`.
 *
 * Пейсинг ("не чаще 1 рекламы на N постов", `CreatorProfile.
 * maxAdFrequencyRatio`) — ЗАНОВО с нуля на каждой странице ленты, не
 * сквозной счётчик через курсорную пагинацию/между разными зрителями:
 * честное упрощение v1 (названо явно, не скрыто) — состояние "сколько
 * постов этого creator'а виджет уже показал ЭТОМУ зрителю" нигде не
 * персистится. При типичном размере страницы (20) и `maxAdFrequencyRatio`
 * по умолчанию 5 разница на практике нечувствительна.
 *
 * Подбор кампании среди назначенных этому creator'у (`NativeAdAssignment`,
 * ручное назначение, Phase 3 заменит на AI) — случайный, не round-robin с
 * Redis, как у `AdEngineService`: там кэш нужен из-за возможного огромного
 * числа ОДНОВРЕМЕННЫХ паблишеров одной категории на сайте с высокой
 * посещаемостью; здесь пул кандидатов — назначения ОДНОГО конкретного
 * creator'а, всегда маленький (ручное назначение), лишняя инфраструктура не
 * оправдана.
 */
@Injectable()
export class NativeAdFeedService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdsForPosts(postIds: string[]): Promise<Record<string, NativeAdFeedItemDto>> {
    if (postIds.length === 0) return {};

    const posts = await this.prisma.post.findMany({
      where: { id: { in: postIds } },
      select: { id: true, authorId: true },
    });
    const authorIdByPostId = new Map(posts.map((post) => [post.id, post.authorId]));
    const authorIds = [...new Set(posts.map((post) => post.authorId))];
    if (authorIds.length === 0) return {};

    const creators = await this.prisma.creatorProfile.findMany({
      where: { userId: { in: authorIds }, status: 'active', monetizationEnabled: true },
      select: {
        id: true,
        userId: true,
        maxAdFrequencyRatio: true,
        blockedCategories: true,
        blockedAdvertiserIds: true,
      },
    });
    if (creators.length === 0) return {};
    const creatorByUserId = new Map(creators.map((creator) => [creator.userId, creator]));

    // Порядок как в присланном `postIds` — клиент шлёт их в порядке
    // отображения на экране, пейсинг (`selectPacedPostIds`) должен считаться
    // в том же порядке.
    const orderedContexts: { postId: string; creator: FeedCreatorContext }[] = [];
    for (const postId of postIds) {
      const authorId = authorIdByPostId.get(postId);
      const creator = authorId ? creatorByUserId.get(authorId) : undefined;
      if (creator) orderedContexts.push({ postId, creator });
    }
    const creatorByPostId = new Map(orderedContexts.map((c) => [c.postId, c.creator]));

    const result: Record<string, NativeAdFeedItemDto> = {};
    for (const postId of selectPacedPostIds(orderedContexts)) {
      const creator = creatorByPostId.get(postId);
      if (!creator) continue;

      const candidate = await this.pickCandidate(creator);
      if (!candidate) continue;

      result[postId] = {
        assignmentId: candidate.assignmentId,
        campaignId: candidate.campaignId,
        creativeId: candidate.creativeId,
        sponsorName: candidate.sponsorName,
        style: candidate.style,
        headline: candidate.headline,
        bodyText: candidate.bodyText,
        imageUrl: candidate.imageUrl,
        videoUrl: candidate.videoUrl,
        ctaLabel: candidate.ctaLabel,
        targetUrl: candidate.targetUrl,
      };
    }

    return result;
  }

  private async pickCandidate(creator: FeedCreatorContext): Promise<EligibleCandidate | null> {
    const assignments = await this.prisma.nativeAdAssignment.findMany({
      where: {
        creatorProfileId: creator.id,
        status: 'active',
        campaign: { status: 'active', paymentStatus: 'paid' },
      },
      include: {
        campaign: {
          include: {
            creatives: { where: { status: 'approved' } },
            advertiserBusiness: { select: { id: true, name: true } },
          },
        },
      },
    });

    const candidates: EligibleCandidate[] = [];
    for (const assignment of assignments) {
      const { campaign } = assignment;
      if (
        isCandidateBlocked(
          { adCategory: campaign.adCategory, advertiserBusinessId: campaign.advertiserBusinessId },
          creator,
        )
      ) {
        continue;
      }
      for (const creative of campaign.creatives) {
        candidates.push({
          assignmentId: assignment.id,
          campaignId: campaign.id,
          creativeId: creative.id,
          sponsorName: campaign.advertiserBusiness.name,
          style: creative.style,
          headline: creative.headline,
          bodyText: creative.bodyText,
          imageUrl: creative.imageUrl,
          videoUrl: creative.videoUrl,
          ctaLabel: creative.ctaLabel,
          targetUrl: creative.targetUrl,
          advertiserBusinessId: campaign.advertiserBusinessId,
        });
      }
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}
