import type { BusinessCategory } from '@/entities/business';
import type { PaymentStatus } from '@/entities/order';
import type { PlanTier } from '@/entities/subscription';

export type AdPlacement = 'header' | 'content' | 'sidebar' | 'footer' | 'in_feed' | 'feed_sidebar';

/** Только подписи для owner-facing форм (`AdCampaignFormModal`) — пиксельные
 * размеры/допустимые форматы места размещения владельцу-рекламодателю не
 * нужны (это забота владельца сайта-паблишера, см. `AD_PLACEMENT_CONFIG` в
 * `entities/website/blocks/advertising`, отдельная независимая копия по
 * тому же принципу, что и backend `ad-placement-config.ts`).
 *
 * `feed_sidebar` — не сайт стороннего бизнеса, а сама лента Таверны
 * (`widgets/feed`, см. backend `AdEngineService.selectCreativesForFeed`) —
 * отдельная подпись от `sidebar`, чтобы рекламодатель не путал одно с
 * другим при выборе мест размещения. */
export const AD_PLACEMENT_LABELS: Record<AdPlacement, string> = {
  header: 'Шапка',
  content: 'В контенте',
  sidebar: 'Сайдбар сайта',
  footer: 'Подвал',
  in_feed: 'В ленте',
  feed_sidebar: 'Сайдбар ленты Таверны',
};

export type AdCampaignStatus =
  'draft' | 'pending_review' | 'active' | 'paused' | 'rejected' | 'completed';

export const AD_CAMPAIGN_STATUS_LABELS: Record<AdCampaignStatus, string> = {
  draft: 'Черновик',
  pending_review: 'На модерации',
  active: 'Активна',
  paused: 'Приостановлена',
  rejected: 'Отклонена',
  completed: 'Завершена',
};

/** Тонкая модерация ПОВЕРХ `AdCampaignStatus` — см. backend `AdCreativeStatus`'s
 * комментарий в schema.prisma: снимает один креатив с показа, не трогая
 * статус всей кампании. */
export type AdCreativeStatus = 'approved' | 'rejected';

export const AD_CREATIVE_STATUS_LABELS: Record<AdCreativeStatus, string> = {
  approved: 'Одобрен',
  rejected: 'Отклонён',
};

/** Рекламодатель выбирает при создании кампании — см. backend
 * `AdBillingModel`'s комментарий: `cpm` списывает `bidCents` за 1000
 * показов, `cpc` — за клик. */
export type AdBillingModel = 'cpm' | 'cpc';

export const AD_BILLING_MODEL_LABELS: Record<AdBillingModel, string> = {
  cpm: 'CPM (за 1000 показов)',
  cpc: 'CPC (за клик)',
};

export type AdFormat =
  | 'banner'
  | 'large_banner'
  | 'rectangle'
  | 'square'
  | 'mobile_banner'
  | 'native'
  | 'card'
  | 'video';

export const AD_FORMAT_LABELS: Record<AdFormat, string> = {
  banner: 'Баннер',
  large_banner: 'Большой баннер',
  rectangle: 'Прямоугольник',
  square: 'Квадрат',
  mobile_banner: 'Мобильный баннер',
  native: 'Нативный',
  card: 'Карточка',
  video: 'Видео',
};

/** Сколько рекламных слотов доступно бизнесу — см. backend `AdvertisingInventoryService`
 * (единственный источник истины, производная от `PlanTier`, НЕ от
 * `Business.capabilities`). `tier: null` — подписки ещё нет вообще. */
export interface AdInventory {
  tier: PlanTier | null;
  limit: number;
  occupied: number;
  available: number;
}

/** Владелец-facing креатив (см. backend `AdCreativeDto`) — полная форма, в
 * отличие от `SelectedAd`, отданного анонимному посетителю (см. её
 * комментарий ниже): содержит `status`/`rejectionReason` тонкой модерации
 * ПОВЕРХ статуса кампании. */
export interface AdCreative {
  id: string;
  campaignId: string;
  format: AdFormat;
  headline: string;
  description: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  ctaLabel: string | null;
  targetUrl: string;
  /** Карточка товара — id товара, чей снимок стал headline/description/
   * imageUrl при создании (см. backend `AdCreative.productId`'s комментарий).
   * `null` — обычный, вручную заполненный креатив. */
  productId: string | null;
  status: AdCreativeStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Владелец-facing кампания (см. backend `AdCampaignDto`) — self-service
 * CRUD-объект `AdCampaignsController`/`AdCampaignsService`, отдельный от
 * `SelectedAd` (публичная витрина) и от админ-локальных типов в
 * `entities/admin` (та же форма, но читается АДМИНОМ по всем кампаниям
 * платформы, не владельцем по своим). */
export interface AdCampaign {
  id: string;
  advertiserBusinessId: string;
  name: string;
  status: AdCampaignStatus;
  rejectionReason: string | null;
  budgetCents: number;
  spentCents: number;
  currency: string;
  paymentStatus: PaymentStatus;
  billingModel: AdBillingModel;
  bidCents: number;
  /** Generalized Second Price — реальная цена списания сейчас (см. backend
   * `AdCampaign.effectiveUnitPriceCents`'s комментарий), не собственная
   * ставка `bidCents`. `null` — ни один показ/клик ещё не пересчитал цену
   * погашения. Обычно `<= bidCents`, никогда не больше. */
  currentUnitPriceCents: number | null;
  impressionsServed: number;
  clicksServed: number;
  startDate: string | null;
  endDate: string | null;
  targetCategories: BusinessCategory[];
  targetPlacements: AdPlacement[];
  targetDevices: string[];
  /** ISO 3166-1 alpha-2 — см. backend `AdCampaign.targetCountries`'s
   * комментарий. Пусто — любая страна; определяется по IP посетителя на
   * backend, сам список здесь только задаёт разрешённые страны. */
  targetCountries: string[];
  /** Декларативный флаг «18+», НЕ реальная проверка возраста посетителя —
   * см. backend `AdCampaign.isAdultContent`'s комментарий. */
  isAdultContent: boolean;
  createdAt: string;
  updatedAt: string;
  creatives: AdCreative[];
  /** Только в ответе `submitForReview`, когда `PaymentProvider` реально
   * создал `PaymentIntent` — тот же принцип, что `Order.clientSecret`. */
  clientSecret?: string;
}

/** Форма, принимаемая `POST .../campaigns` (см. backend `CreateAdCampaignDto`)
 * — валюта НЕ входит, backend берёт её из `Business.currency`
 * рекламодателя (см. её комментарий). */
export interface CreateAdCampaignInput {
  name: string;
  budgetCents: number;
  billingModel: AdBillingModel;
  bidCents: number;
  targetCategories?: BusinessCategory[];
  targetPlacements: AdPlacement[];
  targetDevices?: ('desktop' | 'tablet' | 'mobile')[];
  targetCountries?: string[];
  isAdultContent?: boolean;
  startDate?: string;
  endDate?: string;
}

/** Форма, принимаемая `POST .../creatives` (см. backend `AddAdCreativeDto`)
 * — `imageUrl`/`videoUrl` должны быть уже загруженным файлом этого
 * бизнеса (см. `uploadAdCreativeImage`), backend перепроверяет это
 * независимо по `MediaAssetsService`.
 *
 * `format`/`headline` физически необязательны здесь (не отмечены `?` —
 * форма всегда одна из двух веток, см. `AdCreativeFormModal`): при заданном
 * `productId` (карточка товара) backend сам снимает слепок с товара,
 * присланные `format`/`headline`/`description`/`imageUrl` игнорирует —
 * поэтому в этой ветке их просто не передают вовсе. */
export interface AddAdCreativeInput {
  format?: AdFormat;
  headline?: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  ctaLabel?: string;
  targetUrl: string;
  /** Карточка товара — id существующего `Product` этого бизнеса. Когда
   * задан, `format`/`headline`/`description`/`imageUrl` не передаются. */
  productId?: string;
}

/** То, что реально отдаётся анонимному посетителю сайта-паблишера (см.
 * backend `SelectedAdDto`) — НЕ полный креатив владельца, только то, что
 * нужно отрисовать + идентификаторы для последующих impression/click. */
export interface SelectedAd {
  campaignId: string;
  creativeId: string;
  format: AdFormat;
  headline: string;
  description: string | null;
  imageUrl: string | null;
  /** Только для `format: 'video'`. */
  videoUrl: string | null;
  ctaLabel: string | null;
  targetUrl: string;
}

/** Ответ `GET .../advertising/placement-insights` (см. backend
 * `PlacementInsightDto`) — счётчик активных кампаний на место плюс средний
 * eCPM, ПРИВЕДЁННЫЙ К USD backend'ом (см. `ExchangeRatesService`) — здесь
 * уже готовое число в минимальных единицах USD, никакой конвертации на
 * frontend не требуется. Используется `AdCampaignFormModal`, чтобы
 * подсказать «популярные»/«свободные» места — сортировку по возрастанию/
 * убыванию делает сам компонент, не этот тип. */
export interface PlacementInsight {
  placement: AdPlacement;
  activeCampaignCount: number;
  /** `null` — на месте нет активных кампаний, либо ни одну не удалось
   * конвертировать в USD прямо сейчас (курсы временно недоступны). */
  avgEffectiveCpmUsdCents: number | null;
}
