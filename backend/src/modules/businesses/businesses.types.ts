import type { BusinessCategory } from '@prisma/client';
import type { WorkingHours } from './lib/working-hours';

export interface SocialLinkDto {
  platform: string;
  url: string;
}

/** Реальные капабилити сегодня — `commerce` (`Product`/`ProductsModule`),
 * `booking` (`Service`/`ServicesModule`) и `content` (`BlogPost`/
 * `BlogPostsModule`), см. комментарий `Business.capabilities` в
 * schema.prisma. Список растёт по мере того, как появляются реальные
 * капабилити, а не заранее (тот же принцип, что уже применён к отказу
 * строить общий `Capability`-реестр раньше первой настоящей капабилити, см.
 * ROADMAP.md §8 Phase 3/4). Используется и в `UpdateBusinessDto` (`@IsIn`),
 * и здесь как единственный источник допустимых значений — не дублируется
 * строкой в DTO. */
export const BUSINESS_CAPABILITIES = ['commerce', 'booking', 'content'] as const;
export type BusinessCapability = (typeof BUSINESS_CAPABILITIES)[number];

/** `status` не хранится в БД отдельным полем — производится от
 * `Website.publishedAt` (см. схему, комментарий модели `Website`), чтобы не
 * держать два источника правды об одном и том же факте. */
export type BusinessStatus = 'draft' | 'published';

export interface BusinessDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: BusinessCategory;
  logoUrl: string | null;
  faviconUrl: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  socialLinks: SocialLinkDto[];
  seoTitle: string | null;
  seoDescription: string | null;
  capabilities: string[];
  /** Единая валюта бизнеса (Currency System, ROADMAP.md §8) — источник
   * истины для всех `Product`/`Service` этого бизнеса (у них больше нет
   * собственного поля `currency`, см. их DTO) и снэпшот-точка для новых
   * `Order`/`Appointment`. Список допустимых кодов — `SUPPORTED_CURRENCY_
   * CODES` в `modules/currencies/currencies.ts`. */
  currency: string;
  /** Единая налоговая ставка бизнеса в базисных пунктах (2000 = 20.00%) —
   * см. `PRICING_ARCHITECTURE.md` §3, один плоский тариф на бизнес, не
   * multi-region таблица. */
  taxRateBps: number;
  /** `none` — налог не считается (значение по умолчанию для всех
   * существующих бизнесов после миграции). */
  taxMode: TaxMode;
  /** `null` — часы не заданы, записи принимаются в любое время (см.
   * комментарий `Business.workingHours` в schema.prisma). */
  workingHours: WorkingHours | null;
  /** `null` — Web3-кошелёк ещё не задан (см. `Business.web3WalletAddress`
   * в schema.prisma, AI_PLATFORM_ROADMAP.md §2.6). */
  web3WalletAddress: string | null;
  /** `true` — у бизнеса задан API-ключ Alchemy, без которого Web3-раздел
   * недоступен (платформа своего ключа не предоставляет, только сеть —
   * AI_PLATFORM_ROADMAP.md §19.2). Сам ключ (`Business.web3AlchemyApiKey`)
   * никогда не отдаётся клиенту — только этот boolean-флаг. */
  hasOwnWeb3ApiKey: boolean;
  status: BusinessStatus;
  createdAt: string;
  updatedAt: string;
}

export const TAX_MODES = ['none', 'inclusive', 'exclusive'] as const;
export type TaxMode = (typeof TAX_MODES)[number];
