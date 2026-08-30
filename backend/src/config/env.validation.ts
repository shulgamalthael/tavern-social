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

  /** Необязателен — без него `GeminiAdapter.isConfigured()` возвращает
   * `false`, `AiController` отвечает 503 вместо падения при старте (тот же
   * приём, что у `STRIPE_SECRET_KEY` выше). См. `AI_PLATFORM_ROADMAP.md` §5. */
  @IsOptional()
  @IsString()
  GEMINI_API_KEY?: string;

  /** Модель Gemini для tool-calling — вынесена в конфиг, а не захардкожена
   * в `GeminiAdapter`, чтобы сменить модель (например, при выходе новой
   * версии) не трогая код. */
  @IsOptional()
  @IsString()
  GEMINI_MODEL?: string;
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
