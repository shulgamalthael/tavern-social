import { Global, Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Глобальный модуль — шлюз нужен в нескольких доменных модулях (threads —
 * новые сообщения, friends — заявки в друзья), которые иначе не должны
 * ничего знать друг о друге. Провайдер этого модуля доступен везде без
 * повторного импорта в каждый feature-модуль (тот же приём, что и
 * `RedisModule`, см. `src/infrastructure/redis/redis.module.ts`).
 */
@Global()
@Module({
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
