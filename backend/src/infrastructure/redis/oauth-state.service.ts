import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis-client.provider';

const STATE_KEY_PREFIX = 'oauth-state:';
const STATE_TTL_SECONDS = 10 * 60;

/**
 * CSRF-защита OAuth authorization code flow (`GET /auth/google`, `GET
 * /auth/google/callback`) — тот же приём одноразового токена в Redis, что у
 * `SocketTicketsService`. Значение — не просто заглушка `'1'`, а адрес
 * frontend, на который нужно вернуть браузера ПОСЛЕ входа (см.
 * `AuthService.resolveOAuthOrigin`) — Google возвращает в callback только
 * `code`/`state`, поэтому единственный способ пронести исходный origin через
 * весь flow (браузер → backend → Google → backend) — сохранить его здесь
 * при выдаче `state` и прочитать обратно при его потреблении.
 */
@Injectable()
export class OAuthStateService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async issue(origin: string): Promise<string> {
    const state = randomBytes(24).toString('hex');
    await this.redis.set(this.key(state), origin, 'EX', STATE_TTL_SECONDS);
    return state;
  }

  /** Возвращает сохранённый origin и немедленно удаляет запись — повторно
   * использовать state нельзя. `null`, если state не найден/истёк/подделан. */
  async consume(state: string): Promise<string | null> {
    const key = this.key(state);
    const origin = await this.redis.get(key);
    if (origin !== null) {
      await this.redis.del(key);
    }
    return origin;
  }

  private key(state: string): string {
    return `${STATE_KEY_PREFIX}${state}`;
  }
}
