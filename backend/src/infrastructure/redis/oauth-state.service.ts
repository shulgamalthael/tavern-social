import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis-client.provider';

const STATE_KEY_PREFIX = 'oauth-state:';
const STATE_TTL_SECONDS = 10 * 60;

/**
 * CSRF-защита OAuth authorization code flow (`GET /auth/google`, `GET
 * /auth/google/callback`) — тот же приём одноразового токена в Redis, что у
 * `SocketTicketsService`, но проще по смыслу: не несёт userId, только
 * доказывает, что callback пришёл в ответ на flow, который backend сам
 * инициировал (стандартный OAuth `state`-параметр), а не подделан.
 */
@Injectable()
export class OAuthStateService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async issue(): Promise<string> {
    const state = randomBytes(24).toString('hex');
    await this.redis.set(this.key(state), '1', 'EX', STATE_TTL_SECONDS);
    return state;
  }

  /** Проверяет и немедленно удаляет — повторно использовать state нельзя. */
  async consume(state: string): Promise<boolean> {
    const key = this.key(state);
    const existed = await this.redis.get(key);
    if (existed !== null) {
      await this.redis.del(key);
    }
    return existed !== null;
  }

  private key(state: string): string {
    return `${STATE_KEY_PREFIX}${state}`;
  }
}
