import { pluralizeRu } from '@/common/lib/pluralize-ru';

/**
 * Ранжирование creator'ов под кампанию (Creator Monetization Phase 3, см.
 * AI_PLATFORM_ROADMAP.md §81) — детерминированный, объяснимый скоринг, НЕ
 * вызов Gemini. Собственный пример владельца ("68% audience overlap")
 * описывает именно вычисляемый процент, не текст, сгенерированный моделью
 * — то же решение, что уже принято для `AdEngineService`
 * (`calculateEffectiveCpmCents`) и `NativeAdFeedService`
 * (`selectPacedPostIds`/`isCandidateBlocked`): там, где результат можно
 * честно посчитать и объяснить формулой, в проекте не заводят LLM-вызов
 * поверх — тем более что реальный ключ Gemini API в этом проекте
 * периодически исчерпан (см. §78's комментарий). "AI-подбор" здесь — это
 * прозрачный алгоритм с объяснимыми причинами (`reasons`), которые видит
 * администратор перед РУЧНЫМ решением назначить кампанию — не замена его
 * решения, а подсказка.
 */

export interface CampaignTargeting {
  /** Пусто — кампания не ограничивает категорию (см. `NativeAdCampaign`'s
   * комментарий в schema.prisma: "любая категория", не "ни одна"). */
  targetCategoryIds: string[];
  /** Пусто — кампания не ограничивает географию. Сравнение регистро-
   * независимое (см. `scoreCreatorMatch`). */
  targetGeography: string[];
}

export interface CreatorMatchProfile {
  creatorProfileId: string;
  /** Все назначенные категории creator'а (основная + дополнительные) —
   * `primaryCategoryId` даёт больший вес совпадению, чем просто "входит в
   * этот список" (см. `CATEGORY_WEIGHT_PRIMARY`/`_SECONDARY`). */
  categoryIds: string[];
  primaryCategoryId: string | null;
  city: string | null;
  /** Друзья ПЛЮС подписчики (§85, `Subscription`) — реальный охват
   * creator'а, оба канала одинаково доставляют его посты в чужую ленту
   * (`PostsService.listFeed`). Простая сумма, не отдельные поля: для этой
   * ранжирующей подсказки не важно разделение источников, важен размер
   * аудитории целиком. */
  audienceSize: number;
}

export interface CreatorMatchResult {
  creatorProfileId: string;
  /** 0..1 — внутренний вес для сортировки. */
  score: number;
  /** Округлённый процент для UI — тот же смысл, что "68% audience overlap"
   * из примера владельца. */
  matchPercent: number;
  /** Человекочитаемые причины — ПОЧЕМУ такой score, не просто число без
   * объяснения (корневой план фичи, requirement #8 — "explained match
   * reasoning"). Всегда непусто. */
  reasons: string[];
}

const CATEGORY_WEIGHT = 0.6;
const GEOGRAPHY_WEIGHT = 0.4;
const CATEGORY_SCORE_PRIMARY = 1;
const CATEGORY_SCORE_SECONDARY = 0.6;
const CATEGORY_SCORE_NONE = 0;
const GEOGRAPHY_SCORE_MATCH = 1;
/** Не 0 — географию кампании в Phase 3 всё ещё можно уточнить вручную
 * админом при назначении (см. `NativeAdAssignmentsService.assign`),
 * несовпадение по гео не должно полностью обнулять creator'а, который,
 * например, отлично подходит по категории. */
const GEOGRAPHY_SCORE_NO_MATCH = 0.2;

export function scoreCreatorMatch(
  campaign: CampaignTargeting,
  creator: CreatorMatchProfile,
): CreatorMatchResult {
  const reasons: string[] = [];

  let categoryScore: number;
  if (campaign.targetCategoryIds.length === 0) {
    categoryScore = CATEGORY_SCORE_PRIMARY;
    reasons.push('Кампания не ограничивает категорию — подходит любой creator');
  } else if (
    creator.primaryCategoryId &&
    campaign.targetCategoryIds.includes(creator.primaryCategoryId)
  ) {
    categoryScore = CATEGORY_SCORE_PRIMARY;
    reasons.push('Основная категория creator’а совпадает с таргетингом кампании');
  } else if (creator.categoryIds.some((id) => campaign.targetCategoryIds.includes(id))) {
    categoryScore = CATEGORY_SCORE_SECONDARY;
    reasons.push('Дополнительная категория creator’а совпадает с таргетингом кампании');
  } else {
    categoryScore = CATEGORY_SCORE_NONE;
    reasons.push('Категории не совпадают с таргетингом кампании');
  }

  let geographyScore: number;
  const normalizedCity = creator.city?.trim().toLowerCase() || null;
  if (campaign.targetGeography.length === 0) {
    geographyScore = GEOGRAPHY_SCORE_MATCH;
    reasons.push('Кампания не ограничивает географию');
  } else if (
    normalizedCity &&
    campaign.targetGeography.some((location) => location.trim().toLowerCase() === normalizedCity)
  ) {
    geographyScore = GEOGRAPHY_SCORE_MATCH;
    reasons.push(`География совпадает: ${creator.city}`);
  } else {
    geographyScore = GEOGRAPHY_SCORE_NO_MATCH;
    reasons.push('География не совпадает с таргетингом кампании');
  }

  reasons.push(
    `Аудитория: ${creator.audienceSize.toLocaleString('ru-RU')} ${pluralizeRu(creator.audienceSize, ['человек', 'человека', 'человек'])}`,
  );

  const score = CATEGORY_WEIGHT * categoryScore + GEOGRAPHY_WEIGHT * geographyScore;
  return {
    creatorProfileId: creator.creatorProfileId,
    score,
    matchPercent: Math.round(score * 100),
    reasons,
  };
}

/** Сортировка по убыванию score — стабильная (Array.prototype.sort в V8
 * стабилен для массивов такого размера), при равном score порядок исходного
 * списка сохраняется, а не перемешивается. */
export function rankCreatorMatches(
  campaign: CampaignTargeting,
  creators: CreatorMatchProfile[],
): CreatorMatchResult[] {
  return creators
    .map((creator) => scoreCreatorMatch(campaign, creator))
    .sort((a, b) => b.score - a.score);
}
