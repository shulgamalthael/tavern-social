import { Global, Module, type OnModuleDestroy } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { PresenceService } from './presence.service';
import { REDIS_CLIENT, redisClientProvider } from './redis-client.provider';
import { SessionsService } from './sessions.service';
import { SocketTicketsService } from './socket-tickets.service';

/**
 * Глобальный модуль — Redis нужен в auth (сессии), websocket-шлюзе
 * (presence, тикеты) и friends (онлайн-статус друзей). Провайдеры этого
 * модуля доступны везде без повторного импорта в каждый feature-модуль.
 */
@Global()
@Module({
  providers: [redisClientProvider, SessionsService, SocketTicketsService, PresenceService],
  exports: [REDIS_CLIENT, SessionsService, SocketTicketsService, PresenceService],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
