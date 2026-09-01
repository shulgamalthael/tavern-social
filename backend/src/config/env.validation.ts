import { Type, plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUrl, Max, Min, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV = 'development';

  // process.env отдаёт только строки — @Type(() => Number) явно приводит их
  // к числу перед проверкой @IsInt()/@Min()/@Max() (implicit conversion без
  // явного @Type здесь не срабатывает для полей со значением по умолчанию).
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsUrl({ require_tld: false })
  FRONTEND_URL!: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

  @Type(() => Number)
  @IsInt()
  @Min(10)
  SOCKET_TICKET_TTL_SECONDS = 60;

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;

  @IsOptional()
  @IsString()
  SITES_BASE_DOMAIN?: string;

  /** Необязательны — без них `StripeAdapter` просто не создаёт `PaymentIntent`
   * (заказ по-прежнему создаётся как заявка без оплаты, см. `OrdersService.
   * createFromCart`), чтобы клонировавший репозиторий разработчик без
   * Stripe-аккаунта не упирался в падение при старте. */
  @IsOptional()
  @IsString()
  STRIPE_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  STRIPE_WEBHOOK_SECRET?: string;

  /** Секрет вебхука Payment Plans v1 (`webhooks/stripe-subscriptions`,
   * см. `SubscriptionWebhookController`) — отдельный от `STRIPE_WEBHOOK_
   * SECRET` выше (тот про `webhooks/stripe`, заказы), Stripe выдаёт секрет
   * на каждый endpoint отдельно. Необязателен по той же причине, что
   * `STRIPE_SECRET_KEY`. */
  @IsOptional()
  @IsString()
  STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET?: string;

  /** Необязателен — без него `GeminiAdapter.isConfigured()` возвращает
   * `false`, `AiController` отвечает 503 вместо падения при старте (тот же
   * приём, что у `STRIPE_SECRET_KEY` выше). См. `AI_PLATFORM_ROADMAP.md` §5. */
  @IsOptional()
  @IsString()
  GEMINI_API_KEY?: string;

  /** Необязательны — без них `GoogleOAuthAdapter.isConfigured()` возвращает
   * `false`, `GET /auth/google` отвечает 503 вместо падения при старте (тот
   * же приём, что у `GEMINI_API_KEY`). Получить в Google Cloud Console →
   * APIs & Services → Credentials → Create OAuth client ID. */
  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_SECRET?: string;

  /** Публичный адрес backend для `redirect_uri` в OAuth-flow — необязателен,
   * дефолт `http://localhost:{PORT}` (см. `configuration.ts`) подходит для
   * локальной разработки. */
  @IsOptional()
  @IsString()
  OAUTH_CALLBACK_BASE_URL?: string;

  /** Сеть Alchemy (`eth-mainnet`, `eth-sepolia`, ...) — одна на весь
   * backend, не per-business (см. `web3.types.ts`'s комментарий). Ключ
   * платформенным не бывает — только собственный, у каждого бизнеса
   * (`Business.web3AlchemyApiKey`, AI_PLATFORM_ROADMAP.md §19.2). */
  @IsOptional()
  @IsString()
  ALCHEMY_NETWORK?: string;

  /** Модель Gemini для tool-calling — вынесена в конфиг, а не захардкожена
   * в `GeminiAdapter`, чтобы сменить модель (например, при выходе новой
   * версии) не трогая код. */
  @IsOptional()
  @IsString()
  GEMINI_MODEL?: string;

  /** Global (across всех инстансов backend) RPM/RPD-бюджет Gemini и
   * safety-запас под ним — см. `GeminiQuotaService`. Необязательны: дефолты
   * в `configuration.ts` ориентированы на реальный бесплатный tier, менять
   * нужно только при смене плана/модели. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  GEMINI_RPM_LIMIT?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  GEMINI_RPM_SAFETY_LIMIT?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  GEMINI_RPD_LIMIT?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  GEMINI_RPD_SAFETY_LIMIT?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  GEMINI_MAX_RETRIES?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  GEMINI_RETRY_BASE_DELAY_MS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  GEMINI_QUEUE_MAX_WAIT_MS?: number;

  /** AI Capacity & Cost Manager — см. `configuration.ts`'s комментарии рядом
   * с соответствующими полями `AppConfig` для смысла каждого значения. */
  @IsOptional()
  @Type(() => Number)
  GEMINI_INPUT_PRICE_PER_MILLION_USD?: number;

  @IsOptional()
  @Type(() => Number)
  GEMINI_OUTPUT_PRICE_PER_MILLION_USD?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  AI_CAPACITY_WARNING_PERCENT?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  AI_CAPACITY_CRITICAL_PERCENT?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  AI_CAPACITY_EMERGENCY_PERCENT?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  AI_CAPACITY_SNAPSHOT_INTERVAL_MS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  AI_RAW_REQUEST_RETENTION_DAYS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  AI_AGGREGATION_INTERVAL_MS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  AI_DEDUP_CACHE_TTL_MS?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  AI_ANOMALY_RATE_MULTIPLIER?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  AI_ANOMALY_RETRY_SPIKE_THRESHOLD?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  AI_RECOMMENDATION_INTERVAL_MS?: number;
}

/** Валидирует process.env один раз при старте — падаем сразу, а не на первом запросе. */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Некорректная конфигурация окружения: ${details}`);
  }

  return validated;
}
