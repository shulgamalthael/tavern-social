import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AdCampaign, AdCreative, AdPlacement, BusinessCategory } from '@prisma/client';
import type Redis from 'ioredis';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { REDIS_CLIENT } from '@/infrastructure/redis/redis-client.provider';
import type { SelectedAdDto } from './advertising.types';
import { AD_PLACEMENT_ALLOWED_FORMATS } from './lib/ad-placement-config';
import { calculateEffectiveCpmCents } from './lib/effective-bid';

export interface SelectCreativeInput {
  publisherBusinessId: string;
  placement: AdPlacement;
  /** Не используется для фильтрации сегодня (`AdCampaign.targetDevices`
   * фильтруется только по явному непустому списку — см. ниже), но
   * принимается на будущее (ranking/аналитика) без изменения сигнатуры
   * позже. */
  device?: string;
  locale?: string;
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
 * заранее приведённые к USD).
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

    const candidates = await this.getEligibleCandidates(publisher.category, input.placement);
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
  async selectCreativesForFeed(placement: AdPlacement, count: number): Promise<SelectedAdDto[]> {
    const candidates = await this.getEligibleCandidates(null, placement);
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
   * уже не бросает на плохой анонимный ввод. */
  async getCompetingEffectiveBidsCents(
    publisherBusinessId: string | null,
    placement: AdPlacement,
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

    const candidates = await this.getEligibleCandidates(publisherCategory, placement);
    return candidates.map((candidate) => calculateEffectiveCpmCents(candidate.campaign));
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
