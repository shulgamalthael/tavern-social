import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis-client.provider';

const PRESENCE_HASH_KEY = 'presence:connections';

/**
 * Онлайн-статус пользователя = количество открытых socket-соединений > 0.
 * Считаем в хэше, а не в множестве, чтобы корректно работать с несколькими
 * вкладками/устройствами одного пользователя: пока жив хотя бы один сокет —
 * пользователь «в зале».
 */
@Injectable()
export class PresenceService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async addConnection(userId: string): Promise<void> {
    await this.redis.hincrby(PRESENCE_HASH_KEY, userId, 1);
  }

  /** Возвращает true, если это было последнее соединение пользователя (стал офлайн). */
  async removeConnection(userId: string): Promise<boolean> {
    const remaining = await this.redis.hincrby(PRESENCE_HASH_KEY, userId, -1);
    if (remaining <= 0) {
      await this.redis.hdel(PRESENCE_HASH_KEY, userId);
      return true;
    }
    return false;
  }

  /**
   * Вызывается один раз при старте Socket.IO-шлюза (`RealtimeGateway.afterInit`).
   * После рестарта backend все счётчики в Redis относятся к уже мёртвым
   * сокетам — процесс, который их инкрементировал, не успел вызвать
   * `removeConnection` при обрыве/падении. Без сброса presence «протекает»
   * вверх с каждым рестартом, и пользователи навсегда зависают «в зале»
   * (проверено: 3 рестарта backend за сессию дали счётчик 9–10 вместо
   * реальных 1–2 открытых вкладок).
   *
   * Подходит только для single-instance деплоя (сейчас — один backend-
   * контейнер в docker-compose). Если backend когда-нибудь масштабируют на
   * несколько инстансов за Redis-адаптером, сброс при старте ОДНОГО
   * инстанса будет стирать presence живых соединений на других — тогда
   * нужен per-instance heartbeat/TTL вместо простого reset.
   */
  async resetAll(): Promise<void> {
    await this.redis.del(PRESENCE_HASH_KEY);
  }

  async isOnline(userId: string): Promise<boolean> {
    const count = await this.redis.hget(PRESENCE_HASH_KEY, userId);
    return Boolean(count) && Number(count) > 0;
  }

  /** Возвращает подмножество переданных id, которые сейчас онлайн. */
  async filterOnline(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const counts = await this.redis.hmget(PRESENCE_HASH_KEY, ...userIds);
    const online = new Set<string>();
    userIds.forEach((id, index) => {
      const count = counts[index];
      if (count && Number(count) > 0) online.add(id);
    });
    return online;
  }
}
