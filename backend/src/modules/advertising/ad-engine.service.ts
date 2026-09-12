import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AdCampaign, AdCreative, AdPlacement, BusinessCategory } from '@prisma/client';
import type Redis from 'ioredis';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { REDIS_CLIENT } from '@/infrastructure/redis/redis-client.provider';
import type { SelectedAdDto } from './advertising.types';
import { AD_PLACEMENT_ALLOWED_FORMATS } from './lib/ad-placement-config';
import { calculateEffectiveCpmCents } from './lib/effective-bid';
import { matchesVisitorCountry } from './lib/matches-visitor-country';

export interface SelectCreativeInput {
  publisherBusinessId: string;
  placement: AdPlacement;
  /** Не используется для фильтрации сегодня (`AdCampaign.targetDevices`
   * фильтруется только по явному непустому списку — см. ниже), но
   * принимается на будущее (ranking/аналитика) без изменения сигнатуры
   * позже. */
  device?: string;
  locale?: string;
  /** Реальная фильтрация по `AdCampaign.targetCountries` (см. её
   * комментарий в schema.prisma) — В ОТЛИЧИЕ от `device`/`locale` выше,
   * НЕ клиентский параметр: вычисляется контроллером по IP посетителя
   * (`resolveVisitorCountry`), не приходит из query. Доверять клиентскому
   * значению здесь означало бы, что гео-ограничение обходится одним
   * поддельным параметром запроса — весь смысл был бы потерян. `null` —
   * страну определить не удалось (локальный/приватный IP, нет данных
   * GeoIP) — кампании с непустым `targetCountries` в этом случае не
   * показываются (безопасный дефолт), кампании без ограничения — как
   * обычно. */
  visitorCountry?: string | null;
}

const CACHE_TTL_SECONDS = 60;

interface EligibleCandidate {
  campaign: AdCampaign;
  creative: AdCreative;
}

/**
 * Ad Engine v1 (см. корневой план фичи §4, ранжирование по ставке — §68.8,
 * честное cpm/cpc-сравнение через eCPM — §68.9, настоящий второй-цена-
 * аукцион — закрытие §68.8's "не настоящий аукцион") — таргетинг +
 * конкурентное исключение + Redis-кэш пула кандидатов, ранжирует подходящих
 * кандидатов по эффективной ставке (`calculateEffectiveCpmCents`, `lib/
 * effective-bid.ts` — приводит `cpm` и `cpc` к одному измерению через
 * накопленный CTR кампании), round-robin — только ТАЙБРЕЙК среди кампаний с
 * ОДИНАКОВОЙ максимальной эффективной ставкой, не замена ранжирования.
 * ВЫДАЧА по-прежнему "кто больше платит — тот и показывается", но реальное
 * СПИСАНИЕ (`AdCampaignsService.refreshClearingPrice`, вызывается из
 * `recordImpression`/`recordClick`) теперь честный Generalized Second Price
 * (`getCompetingEffectiveBidsCents` ниже + `lib/clearing-price.ts`) —
 * победитель платит следующую по убыванию ставку конкурента, не свою
 * собственную. Известное упрощение, оставшееся с §68.8/§68.9: сравнение
 * `bidCents`/эффективных ставок между кампаниями НЕ приводится к единой
 * валюте (в отличие от `AdCampaignsService.getPlacementInsights`, где это
 * сделано через `ExchangeRatesService`) — у разных рекламодателей может
 * быть разная `AdCampaign.currency`, и ранжирование/цена погашения сегодня
 * сравнивают их сырые центы как будто это одна валюта; названо явно здесь,
 * не тихо, но не исправлено в этом слайсе — требует отдельного пересмотра
 * горячего пути выдачи (Redis-кэш пула хранит сырые поля кампаний, не
 * заранее приведённые к USD). Реальное региональное ограничение
 * (`AdCampaign.targetCountries`, `resolveVisitorCountry`) закрывает
 * §68's "restricted-category/age/region rule engine" в части region —
 * фильтруется после чтения из кэша (`filterByCountry`), не запечено в
 * него: страна своя у каждого посетителя, а кэш общий для всех.
 */
@Injectable()
export class AdEngineService {
  private readonly logger = new Logger(AdEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async selectCreative(input: SelectCreativeInput): Promise<SelectedAdDto | null> {
    const publisher = await this.prisma.business.findUnique({
      where: { id: input.publisherBusinessId },
      select: { category: true },
    });
    if (!publisher) return null;

    const candidates = this.filterByCountry(
      await this.getEligibleCandidates(publisher.category, input.placement),
      input.visitorCountry,
    );
    if (candidates.length === 0) return null;

    // Ранжирование по эффективной ставке (см. `calculateEffectiveCpmCents`
    // — приводит `cpm`/`cpc` к одному измерению, честнее, чем сравнивать
    // `bidCents` "как есть") — выше эффективная ставка, выше шанс показа;
    // round-robin — тайбрейк только среди кампаний, делящих МАКСИМАЛЬНУЮ
    // эффективную ставку в этом пуле, не среди всех подряд.
    const effectiveBids = candidates.map((candidate) =>
      calculateEffectiveCpmCents(candidate.campaign),
    );
    const maxEffectiveBid = Math.max(...effectiveBids);
    const topCandidates = candidates.filter(
      (_candidate, index) => effectiveBids[index] === maxEffectiveBid,
    );

    const index = await this.nextRoundRobinIndex(
      publisher.category,
      input.placement,
      topCandidates.length,
    );
    return toSelectedAdDto(topCandidates[index]);
  }

  /** Доставка баннеров в сайдбары ленты самой Таверны (`widgets/feed`,
   * `AdPlacement.feed_sidebar`) — в отличие от `selectCreative` выше, здесь
   * нет паблишера-бизнеса: зритель ленты — обычный пользователь Таверны, не
   * чей-то сайт, поэтому нет ни категории для конкурентного исключения, ни
   * таргетинга по категории паблишера (`getEligibleCandidates(null, ...)`
   * пропускает оба фильтра, см. её комментарий). Возвращает СРАЗУ `count`
   * штук под все слоты страницы (2 в левом сайдбаре + 1 в правом, см.
   * `widgets/feed/ui/FeedWidget.tsx`) одним вызовом, не по одному на слот —
   * иначе round-robin тайбрейк `selectCreative` мог бы честно вернуть ОДНУ
   * и ту же кампанию на все слоты сразу. Ранжирование — по эффективной
   * ставке, БЕЗ round-robin: несколько слотов на одной странице — сами по
   * себе желаемое "место 1/2/3 по ставке", тайбрейк здесь не нужен. Один
   * креатив на кампанию за вызов — иначе один рекламодатель занял бы
   * несколько слотов своими разными креативами.
   */
  async selectCreativesForFeed(
    placement: AdPlacement,
    count: number,
    visitorCountry: string | null,
  ): Promise<SelectedAdDto[]> {
    const candidates = this.filterByCountry(
      await this.getEligibleCandidates(null, placement),
      visitorCountry,
    );
    if (candidates.length === 0) return [];

    const bestPerCampaign = new Map<string, EligibleCandidate>();
    for (const candidate of candidates) {
      if (!bestPerCampaign.has(candidate.campaign.id)) {
        bestPerCampaign.set(candidate.campaign.id, candidate);
      }
    }

    return [...bestPerCampaign.values()]
      .sort(
        (a, b) => calculateEffectiveCpmCents(b.campaign) - calculateEffectiveCpmCents(a.campaign),
      )
      .slice(0, count)
      .map(toSelectedAdDto);
  }

  /** Единственный вызывающий — `AdCampaignsService.refreshClearingPrice`
   * (см. её комментарий) — эффективные ставки ВСЕХ кандидатов, реально
   * конкурирующих за ЭТО МЕСТО прямо сейчас, для расчёта Generalized Second
   * Price (`lib/clearing-price.ts`). Намеренно переиспользует тот же
   * `getEligibleCandidates` (тот же Redis-кэш пула, та же логика
   * таргетинга/конкурентного исключения), что и `selectCreative` — цена
   * погашения должна считаться против ТОГО ЖЕ пула, что определяет саму
   * выдачу, не против отдельного, потенциально рассинхронизированного
   * запроса. Пересчитывается заново на каждый показ/клик (не замораживается
   * на момент `selectCreative`, который мог случиться секундами раньше) —
   * честная цена "прямо сейчас", а не устаревший снимок; практически
   * дёшево благодаря тому же 60-секундному кэшу пула.
   *
   * `publisherBusinessId: null` — лента Таверны (`feed_sidebar`, см.
   * `selectCreativesForFeed`), тот же смысл `publisherCategory: null`, что
   * и там. Несуществующий `publisherBusinessId` — пустой пул (кампания,
   * очевидно, ни с кем не конкурирует за место, которого не существует),
   * не ошибка — вызывающий код (`recordImpression`/`recordClick`) и так
   * уже не бросает на плохой анонимный ввод.
   *
   * `excludeCampaignId` — исключает эту кампанию из пула ПО ID, не по
   * значению ставки: пул читается из `getEligibleCandidates`'s 60-секундного
   * Redis-кэша и может честно содержать УСТАРЕВШУЮ копию ЭТОЙ ЖЕ кампании
   * (например, для `cpc` — её `clicksServed`/`impressionsServed`, а значит
   * и eCPM, только что изменились в `recordClick`, ДО пересчёта пула).
   * `calculateClearingPriceCents` пропускает только ТОЧНО совпадающие
   * ставки (`bid < winnerBid`, не `<=`) — устаревшая копия себя самого с
   * ЧУТЬ ДРУГИМ eCPM не была бы распознана как "тот же участник" и
   * ошибочно засчиталась бы конкурентом, искажая цену погашения. Исключение
   * по ID убирает эту двусмысленность в принципе, а не полагается на то,
   * что значения совпадут. */
  async getCompetingEffectiveBidsCents(
    publisherBusinessId: string | null,
    placement: AdPlacement,
    visitorCountry: string | null,
    excludeCampaignId: string,
  ): Promise<number[]> {
    let publisherCategory: BusinessCategory | null = null;
    if (publisherBusinessId) {
      const publisher = await this.prisma.business.findUnique({
        where: { id: publisherBusinessId },
        select: { category: true },
      });
      if (!publisher) return [];
      publisherCategory = publisher.category;
    }

    const candidates = this.filterByCountry(
      await this.getEligibleCandidates(publisherCategory, placement),
      visitorCountry,
    );
    return candidates
      .filter((candidate) => candidate.campaign.id !== excludeCampaignId)
      .map((candidate) => calculateEffectiveCpmCents(candidate.campaign));
  }

  /** `AdCampaign.targetCountries` — НЕ запечено в `getEligibleCandidates`'s
   * Redis-кэш (тот кэшируется по `(категория паблишера, placement)`,
   * ОБЩИЙ для всех посетителей этой пары, а страна — своя у каждого
   * посетителя) — фильтруется здесь, после чтения из кэша, отдельным
   * дешёвым проходом по уже небольшому пулу. Пусто в `targetCountries` —
   * кампания видна из любой страны, та же семантика "пусто значит везде",
   * что у `targetCategories`. */
  private filterByCountry(
    candidates: EligibleCandidate[],
    visitorCountry: string | null | undefined,
  ): EligibleCandidate[] {
    return candidates.filter(({ campaign }) =>
      matchesVisitorCountry(campaign.targetCountries, visitorCountry),
    );
  }

  /** Кэшируется по `(категория паблишера, placement)` — НЕ по конкретному
   * `businessId`: два паблишера одной категории на одном placement видят
   * один и тот же пул кандидатов, честно разделяя дорогой DB-запрос (см.
   * план — "тяжёлый прямой запрос к Postgres на каждый просмотр страницы"
   * недопустим при большом числе сайтов). Round-robin индекс живёт ПОВЕРХ
   * этого пула отдельным счётчиком (см. `nextRoundRobinIndex`), поэтому
   * кэш пула не мешает честной ротации внутри TTL.
   *
   * `publisherCategory: null` — паблишера нет вообще (лента самой Таверны,
   * см. `selectCreativesForFeed`): конкурентное исключение и таргетинг по
   * категории паблишера пропускаются целиком (не с чем сравнивать), кампания
   * попадает в пул, только если у неё вообще нет ограничения по местам не
   * фильтруемым здесь. Кэш-ключ и round-robin счётчик используют `'any'`
   * вместо категории — свой собственный пул, не пересекается с пулами
   * конкретных категорий паблишеров. */
  private async getEligibleCandidates(
    publisherCategory: BusinessCategory | null,
    placement: AdPlacement,
  ): Promise<EligibleCandidate[]> {
    const cacheKey = `ads:pool:${publisherCategory ?? 'any'}:${placement}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as EligibleCandidate[];
      } catch {
        // Повреждённое значение в кэше — перечитываем из БД ниже, не падаем.
      }
    }

    const now = new Date();
    const campaigns = await this.prisma.adCampaign.findMany({
      where: {
        status: 'active',
        paymentStatus: 'paid',
        targetPlacements: { has: placement },
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      include: { creatives: true, advertiserBusiness: { select: { category: true } } },
    });

    const allowedFormats = new Set(AD_PLACEMENT_ALLOWED_FORMATS[placement]);
    const candidates: EligibleCandidate[] = [];
    for (const campaign of campaigns) {
      if (publisherCategory !== null) {
        // Конкурентное исключение (план §4, req. #10): категория рекламодателя
        // совпадает с категорией паблишера → реклама конкурента на сайте
        // конкурента, по умолчанию запрещено, без opt-in в этом слайсе.
        if (campaign.advertiserBusiness.category === publisherCategory) continue;
        // Таргетинг по категории — пусто значит "любая категория" (см.
        // `CreateAdCampaignDto.targetCategories`).
        if (
          campaign.targetCategories.length > 0 &&
          !campaign.targetCategories.includes(publisherCategory)
        ) {
          continue;
        }
      }
      for (const creative of campaign.creatives) {
        // Тонкая модерация поверх `campaign.status` (см. `AdCreativeStatus`'s
        // комментарий в schema.prisma) — снятый креатив не показывается, даже
        // если сама кампания `active` и остальные её креативы одобрены.
        if (creative.status === 'rejected') continue;
        if (allowedFormats.has(creative.format)) {
          candidates.push({ campaign, creative });
        }
      }
    }

    await this.redis.set(cacheKey, JSON.stringify(candidates), 'EX', CACHE_TTL_SECONDS);
    return candidates;
  }

  private async nextRoundRobinIndex(
    publisherCategory: BusinessCategory,
    placement: AdPlacement,
    poolSize: number,
  ): Promise<number> {
    const counterKey = `ads:rr:${publisherCategory}:${placement}`;
    try {
      const next = await this.redis.incr(counterKey);
      return next % poolSize;
    } catch (error) {
      this.logger.warn(`Redis round-robin счётчик недоступен: ${(error as Error).message}`);
      return 0;
    }
  }
}

function toSelectedAdDto({ campaign, creative }: EligibleCandidate): SelectedAdDto {
  return {
    campaignId: campaign.id,
    creativeId: creative.id,
    format: creative.format,
    headline: creative.headline,
    description: creative.description,
    imageUrl: creative.imageUrl,
    videoUrl: creative.videoUrl,
    ctaLabel: creative.ctaLabel,
    targetUrl: creative.targetUrl,
  };
}
