export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  databaseUrl: string;
  redisUrl: string;
  frontendUrl: string;
  sessionTtlSeconds: number;
  socketTicketTtlSeconds: number;
  logLevel: string | undefined;
  /** Базовый домен для системных сабдоменов сайтов (см. `DomainsService`,
   * `{slug}.${sitesBaseDomain}`) — не путать с `frontendUrl` (адрес самого
   * SaaS-приложения/дашборда). Локально — `localhost`, современные Chrome/
   * Firefox резолвят `*.localhost` на 127.0.0.1 без правки hosts-файла. */
  sitesBaseDomain: string;
  /** `undefined`, если Stripe не настроен (нет `.env`-значения) — см.
   * `StripeAdapter`, единственное место, которое их читает. Не бросает
   * ошибку при старте без них намеренно (см. `env.validation.ts`). */
  stripeSecretKey: string | undefined;
  stripeWebhookSecret: string | undefined;
  /** Секрет ВТОРОГО Stripe-вебхука (Payment Plans v1, `modules/billing`,
   * `SubscriptionWebhookController`) — Stripe выдаёт отдельный signing
   * secret на каждый webhook endpoint, поэтому это не то же значение, что
   * `stripeWebhookSecret` выше (тот — для `webhooks/stripe`, заказов).
   * `undefined`-по-умолчанию тем же приёмом: платные тарифы просто
   * недоступны без него, backend не падает при старте. */
  stripeSubscriptionsWebhookSecret: string | undefined;
  /** Секрет ТРЕТЬЕГО Stripe-вебхука (Creator Monetization Phase 1,
   * `modules/creators`, `StripeIdentityWebhookController`) — тот же принцип,
   * что у `stripeSubscriptionsWebhookSecret`: свой signing secret на свой
   * endpoint. `undefined`-по-умолчанию — верификация личности просто
   * недоступна без него (`CreatorIdentityService.isConfigured()`), backend
   * не падает при старте. */
  stripeIdentityWebhookSecret: string | undefined;
  /** Порог подписчиков для Creator-eligibility (корневой план фичи §10
   * второго follow-up сообщения владельца — "не привязывать всю систему к
   * конкретному числу", отсюда env-переопределяемость без правки кода).
   * По подписчикам (`Subscription`), не друзьям — см. §85. См.
   * `CreatorsService.getEligibility`. */
  creatorMinSubscribers: number;
  /** `undefined`, если Gemini не настроен — см. `GeminiAdapter.isConfigured()`,
   * тот же приём, что у `stripeSecretKey`. */
  geminiApiKey: string | undefined;

  /** `undefined`, если вход через Google не настроен — см.
   * `GoogleOAuthAdapter.isConfigured()`, тот же приём, что у `geminiApiKey`.
   * Получить: Google Cloud Console → APIs & Services → Credentials →
   * Create OAuth client ID (Web application). */
  googleOAuthClientId: string | undefined;
  googleOAuthClientSecret: string | undefined;
  /** Публично достижимый адрес САМОГО backend (не `frontendUrl`) — нужен,
   * чтобы построить `redirect_uri` для Google (`${oauthCallbackBaseUrl}/auth/
   * google/callback`), который должен буква-в-букву совпадать с тем, что
   * прописано в Google Cloud Console. Дефолт — `http://localhost:{PORT}`,
   * подходит для локальной разработки; в проде должен быть реальным
   * доменом backend (не тем же, что `frontendUrl`, если они разделены). */
  oauthCallbackBaseUrl: string;
  /** Откуда разрешено начинать OAuth-вход и куда после него можно
   * редиректить браузер, кроме `frontendUrl` самого по себе (тот входит
   * всегда, добавлять его сюда не нужно) — см. `AuthService.resolveOAuthOrigin`.
   * Нужен, когда дашборд открывают ещё откуда-то помимо `frontendUrl`
   * (например, `http://192.168.x.x:3000` в локальной сети при `next start`)
   * — без явного допуска редирект после входа тихо возвращал бы на
   * `frontendUrl`, даже если вход начали с другого адреса. Дефолт — пустой
   * список: без явной настройки поведение то же, что было (всегда
   * `frontendUrl`). */
  allowedOauthOrigins: string[];

  /** Одна сеть Alchemy на весь backend, не per-business (см.
   * `web3.types.ts`) — сам API-ключ платформенным не бывает, только
   * собственный, у каждого бизнеса (`Business.web3AlchemyApiKey`,
   * AI_PLATFORM_ROADMAP.md §19.2). */
  alchemyNetwork: string;
  /** Дефолт — стабильная модель с поддержкой function calling на бесплатном
   * tier (см. `AI_PLATFORM_ROADMAP.md` §2.3). */
  geminiModel: string;
  /** RPM/RPD-лимиты официального плана Gemini и safety-запас под ними — см.
   * `GeminiQuotaService`. Дефолты ниже ориентированы на реальный бесплатный
   * tier (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, см.
   * `AI_PLATFORM_ROADMAP.md` §10.4/§10.7 — оба лимита реально ловились живьём
   * при разработке) — если план сменится, значения переопределяются через
   * `.env`, без правки кода. Safety-лимит ВСЕГДА должен быть строго меньше
   * официального: правило "не отправлять заведомо лишние запросы", а не
   * ждать 429 от самого Gemini. */
  geminiRpmLimit: number;
  geminiRpmSafetyLimit: number;
  geminiRpdLimit: number;
  geminiRpdSafetyLimit: number;
  /** Сколько раз повторить запрос после 429 ПЕРЕД тем, как сдаться
   * (`GeminiRetriesExhaustedError`) — каждая попытка снова резервирует слот
   * RPM/RPD (см. `GeminiQuotaService.waitForSlot`), так что это не бесконечный
   * retry-loop (GEMINI OPTIMIZATION §26). */
  geminiMaxRetries: number;
  geminiRetryBaseDelayMs: number;
  /** Сколько максимум ждать свободный RPM-слот внутри ОДНОГО хода диалога,
   * прежде чем сдаться (`GeminiRpmQueueTimeoutError`) — пользователь ждёт
   * ответа в этом же HTTP/SSE-запросе, бесконечная очередь здесь не имеет
   * смысла (в отличие от RPD, где ждать нечего — сброс раз в сутки). */
  geminiQueueMaxWaitMs: number;

  /** Цена модели за 1M токенов, USD — `undefined`, если оператор не задал
   * (см. `model-pricing.lib.ts`'s комментарий: НЕ придумываем цену за
   * `gemini-3.6-flash`, честно считаем cost "недоступен", пока не настроено). */
  geminiInputPricePerMillionUsd: number | undefined;
  geminiOutputPricePerMillionUsd: number | undefined;

  /** Пороги Capacity Manager (AI CAPACITY & COST MANAGER §9) — % от
   * safety-лимита RPM/RPD (см. `percentOfSafetyLimit` в `ai-capacity.lib.ts`),
   * не от официального лимита плана. */
  aiCapacityWarningPercent: number;
  aiCapacityCriticalPercent: number;
  aiCapacityEmergencyPercent: number;
  /** Как часто писать `AiCapacitySnapshot` фоновым таймером
   * (`AiCapacitySnapshotService`) — не на каждый запрос (те уже покрыты
   * `AiRequestLog`), нужен для видимости тренда capacity в периоды затишья. */
  aiCapacitySnapshotIntervalMs: number;

  /** Сколько дней хранить сырые `AiRequestLog` (`AiRetentionService`) —
   * после дневной агрегации в `AiUsageDailyAggregate` они нужны только для
   * недавнего расследования инцидентов (429-анализ и т. п.), не для
   * долгосрочной аналитики. */
  aiRawRequestRetentionDays: number;
  /** Как часто гонять агрегацию сырых логов в дневные тоталы + подчистку
   * устаревших сырых строк. */
  aiAggregationIntervalMs: number;

  /** Окно, в течение которого повторный запрос с ТЕМ ЖЕ отпечатком
   * (operation+businessId+сообщение) считается дублем и получает
   * закэшированный результат вместо нового обращения к Gemini (см.
   * `AiDedupCacheService`). */
  aiDedupCacheTtlMs: number;

  /** §23 brief'а — во сколько раз текущая частота запросов от одного
   * actor'а должна превысить baseline, чтобы считаться аномалией (см.
   * `isRateAnomaly`). */
  aiAnomalyRateMultiplier: number;
  /** Сколько подряд 429 в скользящем окне (`aiCapacitySnapshotIntervalMs`)
   * считать всплеском retry, а не разовой неудачей. */
  aiAnomalyRetrySpikeThreshold: number;

  /** Как часто пересчитывать рекомендации (§24 brief'а: "AI не должен
   * анализировать каждый request" — периодически/по событию, не на каждый
   * запрос). Дефолт — 30 минут, как в собственном примере задачи. */
  aiRecommendationIntervalMs: number;

  /** Через сколько часов после загрузки файл в `uploads/messages/`, ни разу
   * не привязанный ни к одному отправленному сообщению (`MessageAttachment`
   * — ни AI-чата, ни обычного мессенджера), считается брошенным и
   * подчищается (`UploadsRetentionService`, AI_PLATFORM_ROADMAP.md §43).
   * 24 часа — с большим запасом относительно того, сколько реально длится
   * один ход AI-чата (секунды-минуты), чтобы не задеть ничего ещё в работе. */
  uploadOrphanTtlHours: number;
  /** Как часто гонять сам обход `uploads/messages/` на брошенные файлы —
   * фоновая уборка, не времячувствительная операция, реже, чем AI-агрегация. */
  uploadOrphanSweepIntervalMs: number;

  /** Сколько дней расшаренный виджет (`CustomWidget.isShared`,
   * AI_PLATFORM_ROADMAP.md §74) держится в общем каталоге ДО того, как его
   * можно снять за неиспользование — см. `CustomWidgetCatalogGcService`.
   * 14 дней — достаточно, чтобы виджет реально попался на глаза владельцам
   * других бизнесов хотя бы раз, не настолько долго, чтобы каталог копил
   * явный мусор месяцами. */
  widgetCatalogGraceDays: number;
  /** Минимум вставок ДРУГИМИ бизнесами, чтобы пережить sweep после grace-
   * периода — 1 достаточно: это не рейтинг качества, а просто "кому-то
   * ЕЩЁ, кроме автора, это пригодилось хотя бы раз". */
  widgetCatalogMinInserts: number;
  /** Как часто гонять сам обход каталога — тот же принцип, что у
   * `uploadOrphanSweepIntervalMs`, фоновая уборка не времячувствительна. */
  widgetCatalogGcSweepIntervalMs: number;
}

export default (): { app: AppConfig } => {
  const port = Number(process.env.PORT ?? 4000);

  return {
    app: {
      nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
      port,
      databaseUrl: process.env.DATABASE_URL ?? '',
      redisUrl: process.env.REDIS_URL ?? '',
      frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 30),
      socketTicketTtlSeconds: Number(process.env.SOCKET_TICKET_TTL_SECONDS ?? 60),
      logLevel: process.env.LOG_LEVEL,
      sitesBaseDomain: process.env.SITES_BASE_DOMAIN ?? 'localhost',
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      stripeSubscriptionsWebhookSecret: process.env.STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET,
      stripeIdentityWebhookSecret: process.env.STRIPE_IDENTITY_WEBHOOK_SECRET,
      creatorMinSubscribers: Number(process.env.CREATOR_MIN_SUBSCRIBERS ?? 2000),
      geminiApiKey: process.env.GEMINI_API_KEY,
      googleOAuthClientId: process.env.GOOGLE_CLIENT_ID,
      googleOAuthClientSecret: process.env.GOOGLE_CLIENT_SECRET,
      oauthCallbackBaseUrl: process.env.OAUTH_CALLBACK_BASE_URL ?? `http://localhost:${port}`,
      allowedOauthOrigins: (process.env.ALLOWED_OAUTH_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
      alchemyNetwork: process.env.ALCHEMY_NETWORK ?? 'eth-mainnet',
      // `gemini-2.5-flash` вернул 404 "no longer available to new users" при
      // реальном тесте (2026-08-29) — Google сам называет замену в тексте
      // ошибки. Вынесено в конфиг именно на случай следующей такой миграции.
      geminiModel: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
      geminiRpmLimit: Number(process.env.GEMINI_RPM_LIMIT ?? 15),
      geminiRpmSafetyLimit: Number(process.env.GEMINI_RPM_SAFETY_LIMIT ?? 12),
      geminiRpdLimit: Number(process.env.GEMINI_RPD_LIMIT ?? 1500),
      geminiRpdSafetyLimit: Number(process.env.GEMINI_RPD_SAFETY_LIMIT ?? 1350),
      geminiMaxRetries: Number(process.env.GEMINI_MAX_RETRIES ?? 2),
      geminiRetryBaseDelayMs: Number(process.env.GEMINI_RETRY_BASE_DELAY_MS ?? 1000),
      geminiQueueMaxWaitMs: Number(process.env.GEMINI_QUEUE_MAX_WAIT_MS ?? 20_000),

      geminiInputPricePerMillionUsd: process.env.GEMINI_INPUT_PRICE_PER_MILLION_USD
        ? Number(process.env.GEMINI_INPUT_PRICE_PER_MILLION_USD)
        : undefined,
      geminiOutputPricePerMillionUsd: process.env.GEMINI_OUTPUT_PRICE_PER_MILLION_USD
        ? Number(process.env.GEMINI_OUTPUT_PRICE_PER_MILLION_USD)
        : undefined,

      aiCapacityWarningPercent: Number(process.env.AI_CAPACITY_WARNING_PERCENT ?? 70),
      aiCapacityCriticalPercent: Number(process.env.AI_CAPACITY_CRITICAL_PERCENT ?? 85),
      aiCapacityEmergencyPercent: Number(process.env.AI_CAPACITY_EMERGENCY_PERCENT ?? 95),
      aiCapacitySnapshotIntervalMs: Number(
        process.env.AI_CAPACITY_SNAPSHOT_INTERVAL_MS ?? 5 * 60_000,
      ),

      aiRawRequestRetentionDays: Number(process.env.AI_RAW_REQUEST_RETENTION_DAYS ?? 7),
      aiAggregationIntervalMs: Number(process.env.AI_AGGREGATION_INTERVAL_MS ?? 60 * 60_000),

      aiDedupCacheTtlMs: Number(process.env.AI_DEDUP_CACHE_TTL_MS ?? 60_000),

      aiAnomalyRateMultiplier: Number(process.env.AI_ANOMALY_RATE_MULTIPLIER ?? 5),
      aiAnomalyRetrySpikeThreshold: Number(process.env.AI_ANOMALY_RETRY_SPIKE_THRESHOLD ?? 5),

      aiRecommendationIntervalMs: Number(process.env.AI_RECOMMENDATION_INTERVAL_MS ?? 30 * 60_000),

      uploadOrphanTtlHours: Number(process.env.UPLOAD_ORPHAN_TTL_HOURS ?? 24),
      uploadOrphanSweepIntervalMs: Number(
        process.env.UPLOAD_ORPHAN_SWEEP_INTERVAL_MS ?? 6 * 60 * 60_000,
      ),

      widgetCatalogGraceDays: Number(process.env.WIDGET_CATALOG_GRACE_DAYS ?? 14),
      widgetCatalogMinInserts: Number(process.env.WIDGET_CATALOG_MIN_INSERTS ?? 1),
      widgetCatalogGcSweepIntervalMs: Number(
        process.env.WIDGET_CATALOG_GC_SWEEP_INTERVAL_MS ?? 24 * 60 * 60_000,
      ),
    },
  };
};
