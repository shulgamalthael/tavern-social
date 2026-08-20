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
