export type BusinessCategory =
  | 'restaurant'
  | 'retail'
  | 'services'
  | 'health'
  | 'beauty'
  | 'fitness'
  | 'education'
  | 'technology'
  | 'creative'
  | 'real_estate'
  | 'hospitality'
  | 'nonprofit'
  | 'other';

/** Не хранится отдельным полем на backend — производится от того, публиковал
 * ли пользователь сайт хоть раз (см. `Website.publishedAt` в схеме backend).
 * Здесь просто отражение того же факта. */
export type BusinessStatus = 'draft' | 'published';

export interface SocialLink {
  platform: string;
  url: string;
}

/** Реальные значения сегодня — `'commerce'`, `'booking'` и `'content'` (см.
 * ROADMAP.md §3.3/§8 Phase 5-7) — растёт по мере появления настоящих
 * капабилити, не заранее. Строковый союз, не `enum`/константа с backend —
 * тот же приём, что и у `BusinessCategory` здесь: frontend и backend не
 * делят типы (разные TS-проекты), backend — источник истины валидации. */
export type BusinessCapability = 'commerce' | 'booking' | 'content';

export interface Business {
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
  socialLinks: SocialLink[];
  seoTitle: string | null;
  seoDescription: string | null;
  capabilities: BusinessCapability[];
  /** Единая валюта бизнеса (Currency System, ROADMAP.md §8) — источник
   * истины для всех `Product`/`Service` (у них нет своего поля `currency`,
   * см. их типы) и снэпшот-точка для новых `Order`/`Appointment`.
   * Поддерживаемые коды — `SUPPORTED_CURRENCIES` в `shared/config/
   * currencies.ts`. */
  currency: string;
  /** Единая налоговая ставка бизнеса в базисных пунктах (2000 = 20.00%) —
   * см. `PRICING_ARCHITECTURE.md` §3, один плоский тариф на бизнес. */
  taxRateBps: number;
  /** `none` — налог не считается вообще (значение по умолчанию). */
  taxMode: TaxMode;
  workingHours: WorkingHours | null;
  /** `null` — Web3-кошелёк ещё не задан (AI_PLATFORM_ROADMAP.md §2.6,
   * AI-7). Собственный кошелёк владельца бизнеса для read-only витрины
   * баланса/NFT — не кошелёк покупателя/визитора сайта. */
  web3WalletAddress: string | null;
  /** `true` — у бизнеса задан API-ключ Alchemy, без которого Web3-раздел
   * недоступен (AI_PLATFORM_ROADMAP.md §19.2, платформа своего ключа не
   * предоставляет). Сам ключ никогда не приходит с backend — только этот
   * флаг. */
  hasOwnWeb3ApiKey: boolean;
  /** Внешний рекламодатель без сайта на платформе (AI_PLATFORM_ROADMAP.md
   * §71) — создан через облегчённый кабинет `/advertise/new`, не через
   * обычную форму «Создать бизнес». `BusinessDashboardWidget` рендерит для
   * такого бизнеса урезанный `AdvertiserDashboardWidget` вместо полного
   * дашборда. */
  isAdvertiserOnly: boolean;
  status: BusinessStatus;
  createdAt: string;
  updatedAt: string;
}

export type TaxMode = 'none' | 'inclusive' | 'exclusive';

/** Часы работы бизнеса (Booking, ROADMAP.md §8 Phase 6 continued) — ключ дня
 * недели отсутствует или всё поле `Business.workingHours` — `null` значит
 * «не ограничено» (см. её комментарий в backend schema.prisma): запись
 * принимается в любое время, то же поведение, что было единственным до
 * появления этого поля. `open`/`close` — `"ЧЧ:ММ"`, 24-часовой формат,
 * ровно то, что отдаёт `<input type="time">` без какой-либо обработки. */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Понедельник',
  tue: 'Вторник',
  wed: 'Среда',
  thu: 'Четверг',
  fri: 'Пятница',
  sat: 'Суббота',
  sun: 'Воскресенье',
};

export interface DayHours {
  open: string;
  close: string;
}

export type WorkingHours = Partial<Record<Weekday, DayHours>>;

export const TAX_MODE_LABELS: Record<TaxMode, string> = {
  none: 'Не считать налог',
  inclusive: 'Налог включён в цену',
  exclusive: 'Налог добавляется сверху цены',
};
