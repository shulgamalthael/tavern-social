import type {
  AdBillingModel,
  AdCampaign,
  AdCampaignStatus,
  AdCreative,
  AdCreativeStatus,
  AdFormat,
  AdPlacement,
  BusinessCategory,
  PaymentStatus,
  PlanTier,
} from '@prisma/client';

/** Ответ `AdvertisingInventoryService.getInventory` — единственный источник
 * истины о том, сколько рекламных слотов доступно бизнесу (см. `ad-
 * entitlements.ts`). `tier: null` — подписки ещё нет вообще (тариф не
 * выбирался, см. `BillingService.getStatus`), эквивалент `free`. `occupied`
 * вычисляется на лету обходом документа сайта (`countBlocksOfType`), не
 * хранится отдельно. */
export interface AdInventoryDto {
  tier: PlanTier | null;
  limit: number;
  occupied: number;
  available: number;
}

export interface AdCreativeDto {
  id: string;
  campaignId: string;
  format: AdFormat;
  headline: string;
  description: string | null;
  imageUrl: string | null;
  /** Только для `format: 'video'` — см. её комментарий в schema.prisma. */
  videoUrl: string | null;
  ctaLabel: string | null;
  targetUrl: string;
  /** Карточка товара — id `Product`, чей снимок стал headline/description/
   * imageUrl при создании (см. `AdCreative.productId`'s комментарий в
   * schema.prisma). `null` — обычный, вручную заполненный креатив. Только
   * provenance для UI (бейдж «Товар» в списке) — сам показ рекламы этим
   * полем не пользуется. */
  productId: string | null;
  /** Тонкая модерация ПОВЕРХ `AdCampaign.status` — см. `AdCreativeStatus`'s
   * комментарий в schema.prisma. */
  status: AdCreativeStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Ответ `AdCampaignsService.getPlacementInsights` — счётчик активных
 * (`status: 'active', paymentStatus: 'paid'`) кампаний на место размещения
 * плюс средний eCPM, приведённый к USD (см. `ExchangeRatesService`) —
 * приводить обязательно, у разных рекламодателей разная `AdCampaign.
 * currency`, усреднять сырые центы между валютами методологически неверно
 * (см. `revenueByCurrency` в админ-обзоре, деньги в этом проекте никогда не
 * суммируются между валютами вслепую). Используется формой создания
 * кампании, чтобы подсказать «популярные»/«свободные» места. */
export interface PlacementInsightDto {
  placement: AdPlacement;
  activeCampaignCount: number;
  /** `null` — либо на месте нет активных кампаний, либо ни одну из них не
   * удалось конвертировать в USD прямо сейчас (см. `ExchangeRatesService.
   * convertToUsdCents`'s комментарий про недоступные курсы). */
  avgEffectiveCpmUsdCents: number | null;
}

export interface AdCampaignDto {
  id: string;
  advertiserBusinessId: string;
  name: string;
  status: AdCampaignStatus;
  rejectionReason: string | null;
  budgetCents: number;
  spentCents: number;
  currency: string;
  paymentStatus: PaymentStatus;
  /** См. `AdBillingModel`'s комментарий в schema.prisma — `bidCents` за 1000
   * показов (`cpm`) или за клик (`cpc`), определяет ранжирование в
   * `AdEngineService` и скорость расходования `budgetCents`. `bidCents` —
   * СОБСТВЕННАЯ ставка (потолок ранжирования), а не то, что реально
   * списывается — см. `currentUnitPriceCents` ниже. */
  billingModel: AdBillingModel;
  bidCents: number;
  /** Generalized Second Price — реальная цена, по которой сейчас
   * списывается бюджет (см. `AdCampaign.effectiveUnitPriceCents`'s
   * комментарий в schema.prisma), в том же измерении, что `bidCents`
   * (eCPM за 1000 показов для `cpm`, цена за клик для `cpc`). `null` — ни
   * один показ/клик ещё не пересчитал цену погашения (списание пойдёт по
   * `bidCents`, как первая цена). Прозрачность для рекламодателя: обычно
   * `<= bidCents`, никогда не больше — Vickrey никогда не заставляет
   * платить больше собственной ставки. */
  currentUnitPriceCents: number | null;
  impressionsServed: number;
  clicksServed: number;
  startDate: string | null;
  endDate: string | null;
  targetCategories: BusinessCategory[];
  targetPlacements: AdPlacement[];
  targetDevices: string[];
  /** ISO 3166-1 alpha-2 — см. `AdCampaign.targetCountries`'s комментарий в
   * schema.prisma. Пусто — любая страна. */
  targetCountries: string[];
  /** Декларативный флаг «18+», НЕ реальная проверка возраста посетителя —
   * см. `AdCampaign.isAdultContent`'s комментарий в schema.prisma. */
  isAdultContent: boolean;
  createdAt: string;
  updatedAt: string;
  creatives: AdCreativeDto[];
  /** Только в ответе `submitForReview`, когда `PaymentProvider` реально
   * создал `PaymentIntent` — тот же принцип, что `OrderDto.clientSecret`. */
  clientSecret?: string;
}

export function toAdCreativeDto(creative: AdCreative): AdCreativeDto {
  return {
    id: creative.id,
    campaignId: creative.campaignId,
    format: creative.format,
    headline: creative.headline,
    description: creative.description,
    imageUrl: creative.imageUrl,
    videoUrl: creative.videoUrl,
    ctaLabel: creative.ctaLabel,
    targetUrl: creative.targetUrl,
    productId: creative.productId,
    status: creative.status,
    rejectionReason: creative.rejectionReason,
    createdAt: creative.createdAt.toISOString(),
    updatedAt: creative.updatedAt.toISOString(),
  };
}

export function toAdCampaignDto(
  campaign: AdCampaign & { creatives: AdCreative[] },
  clientSecret?: string,
): AdCampaignDto {
  return {
    id: campaign.id,
    advertiserBusinessId: campaign.advertiserBusinessId,
    name: campaign.name,
    status: campaign.status,
    rejectionReason: campaign.rejectionReason,
    budgetCents: campaign.budgetCents,
    spentCents: campaign.spentCents,
    currency: campaign.currency,
    paymentStatus: campaign.paymentStatus,
    billingModel: campaign.billingModel,
    bidCents: campaign.bidCents,
    currentUnitPriceCents: campaign.effectiveUnitPriceCents,
    impressionsServed: campaign.impressionsServed,
    clicksServed: campaign.clicksServed,
    startDate: campaign.startDate ? campaign.startDate.toISOString() : null,
    endDate: campaign.endDate ? campaign.endDate.toISOString() : null,
    targetCategories: campaign.targetCategories,
    targetPlacements: campaign.targetPlacements,
    targetDevices: campaign.targetDevices,
    targetCountries: campaign.targetCountries,
    isAdultContent: campaign.isAdultContent,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    creatives: campaign.creatives.map(toAdCreativeDto),
    ...(clientSecret ? { clientSecret } : {}),
  };
}

/** Отдаётся анонимному посетителю сайта-паблишера (`GET /sites/:businessId/
 * ads/select`) — НАМЕРЕННО не весь `AdCreativeDto`: без `campaignId`
 * (utility поле для владельца/админа, не нужное на публичной витрине,
 * и без `targetUrl` из отдельного поля `AdCreativeDto`, экспонированного
 * зря — оно здесь же есть, просто под тем же именем). `creativeId`/
 * `campaignId` нужны фронтенду только чтобы передать их обратно в
 * `POST .../ads/impression|click`. */
export interface SelectedAdDto {
  campaignId: string;
  creativeId: string;
  format: AdFormat;
  headline: string;
  description: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  ctaLabel: string | null;
  targetUrl: string;
}

/** Композитный overview для `admin/advertising` (см. `AiInfrastructureController`
 * — тот же принцип "один составной эндпоинт", не 10 разрозненных). */
export interface AdminAdvertisingOverviewDto {
  pendingCampaigns: AdCampaignDto[];
  /** Уже одобренные кампании — единственное место, откуда админ может
   * дойти до per-creative модерации отдельного креатива (см.
   * `AdCreativeStatus`'s комментарий в schema.prisma). */
  activeCampaigns: AdCampaignDto[];
  /** `status: 'paused'` — сегодня только автоматически, при исчерпании
   * бюджета (см. `AdCampaignsService.listPaused`'s комментарий). Без этого
   * поля такая кампания была бы невидима нигде в админке. */
  pausedCampaigns: AdCampaignDto[];
  businesses: {
    businessId: string;
    businessName: string;
    tier: PlanTier | null;
    slotLimit: number;
    slotsOccupied: number;
    slotsAvailable: number;
  }[];
  /** Compliance-примитив "banned advertisers" — см. `AdvertiserBan`'s
   * комментарий в schema.prisma. */
  bannedAdvertisers: {
    businessId: string;
    businessName: string;
    reason: string | null;
    bannedAt: string;
  }[];
  /** Показы/клики по дням за последние 30 дней — платформа целиком, не по
   * кампаниям (разбивка по кампаниям — `campaignPerformance` ниже, закрывает
   * тот самый "полноценный дашборд с разбивкой по кампаниям" из корневого
   * плана). Дни без событий всё равно присутствуют с нулями (см.
   * `bucketByDay`) — иначе график читался бы как "дыра", а не честный ноль. */
  dailyStats: { date: string; impressions: number; clicks: number }[];
  /** Разбивка ПО КАЖДОЙ отдельной кампании, не только платформа целиком —
   * см. `dailyStats`'s комментарий. Все кампании, кроме `draft` (черновик
   * никогда не был отправлен на модерацию — гарантированно нулевая
   * активность, чистый шум в отчёте), отсортированы по `spentCents` по
   * убыванию (админа прежде всего интересует, кто реально тратит). Деньги
   * — `spentCents`/`budgetCents`/`currency` НАТИВНО, В СВОЕЙ валюте каждой
   * строки, не приведены к одной — та же причина, что у `revenueByCurrency`
   * выше: сравнивать/суммировать это поле между строками разных валют
   * нельзя, только смотреть по одной строке за раз. */
  campaignPerformance: AdminCampaignPerformanceDto[];
  totals: {
    impressions: number;
    clicks: number;
    ctr: number;
    /** Ключ — код валюты (`Business.currency`), значение — сумма
     * `budgetCents` оплаченных кампаний В ЭТОЙ валюте. Не единое число: у
     * разных кампаний разная валюта (снята с `Business.currency`
     * рекламодателя, см. `AdCampaignsService.create`), складывать центы
     * разных валют в одно число значило бы честно посчитать бессмысленную
     * сумму. */
    revenueByCurrency: Record<string, number>;
  };
}

/** Одна строка `AdminAdvertisingOverviewDto.campaignPerformance` — см. её
 * комментарий. Не переиспользует `AdCampaignDto` целиком (это была бы
 * лишняя dozen полей — таргетинг/креативы админу здесь не нужны, только
 * что кампания заработала/потратила), только `businessName` добавлен
 * поверх (`AdCampaignDto.advertiserBusinessId` — голый id, бесполезен без
 * похода в другую таблицу за именем на каждой строке фронтенда). */
export interface AdminCampaignPerformanceDto {
  campaignId: string;
  campaignName: string;
  businessId: string;
  businessName: string;
  status: AdCampaignStatus;
  impressionsServed: number;
  clicksServed: number;
  ctr: number;
  spentCents: number;
  budgetCents: number;
  currency: string;
}
