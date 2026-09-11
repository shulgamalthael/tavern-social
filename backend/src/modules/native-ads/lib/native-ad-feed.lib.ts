/** Чисто вычисляемая часть `NativeAdFeedService.getAdsForPosts` — вынесена
 * отдельно, чтобы пейсинг и веты creator'а были юнит-тестируемы без Prisma
 * (тот же приём, что `calculateEffectiveCpmCents` в `advertising/lib/
 * effective-bid.ts`). */

export interface FeedCreatorContext {
  id: string;
  maxAdFrequencyRatio: number;
  blockedCategories: string[];
  blockedAdvertiserIds: string[];
}

/**
 * Пейсинг ("не чаще 1 рекламы на N постов") — считает "постов с прошлой
 * рекламы" по КАЖДОМУ creator'у независимо, в порядке присланного списка
 * (см. `NativeAdFeedService`'s комментарий про честное упрощение "заново на
 * каждой странице ленты"). Возвращает id постов, для которых счётчик достиг
 * `maxAdFrequencyRatio` — именно после них стоит слот рекламы.
 */
export function selectPacedPostIds(
  orderedPosts: { postId: string; creator: FeedCreatorContext }[],
): string[] {
  const result: string[] = [];
  const postsSinceAdByCreator = new Map<string, number>();

  for (const { postId, creator } of orderedPosts) {
    const soFar = (postsSinceAdByCreator.get(creator.id) ?? 0) + 1;
    postsSinceAdByCreator.set(creator.id, soFar);
    if (soFar < creator.maxAdFrequencyRatio) continue;
    result.push(postId);
    postsSinceAdByCreator.set(creator.id, 0);
  }

  return result;
}

export interface BlockableCandidate {
  adCategory: string | null;
  advertiserBusinessId: string;
}

/**
 * Веты creator'а поверх уже назначенной кампании (`NativeAdAssignment`) —
 * заблокированный рекламодатель ИЛИ заблокированная категория рекламы,
 * независимо от того, кто и как решил назначить кампанию этому creator'у
 * (ручное назначение сегодня, AI-подбор в Phase 3 — веты переживут замену
 * без изменений).
 */
export function isCandidateBlocked(
  candidate: BlockableCandidate,
  creator: Pick<FeedCreatorContext, 'blockedCategories' | 'blockedAdvertiserIds'>,
): boolean {
  if (creator.blockedAdvertiserIds.includes(candidate.advertiserBusinessId)) return true;
  if (candidate.adCategory && creator.blockedCategories.includes(candidate.adCategory)) return true;
  return false;
}
