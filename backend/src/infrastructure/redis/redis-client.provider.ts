import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { AppConfig } from '@/config/configuration';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Redis => {
    const app = configService.get<AppConfig>('app');
    return new Redis(app!.redisUrl, {
      // Не блокируем старт приложения — переподключение обрабатывается ioredis
      // само; health check (см. main.ts) отдельно проверяет готовность.
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
  },
};
