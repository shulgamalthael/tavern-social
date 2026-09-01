import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis-client.provider';

const EXCHANGE_KEY_PREFIX = 'oauth-exchange:';
const EXCHANGE_TTL_SECONDS = 60;

/**
 * Одноразовый короткоживущий код обмена OAuth-логина на настоящий
 * session-токен — тот же приём, что у `SocketTicketsService`: backend
 * никогда не кладёт реальный session-токен в query string редиректа
 * браузера (виден в истории браузера/логах сервера/заголовке `Referer`),
 * только этот код. Frontend (`/auth/callback`) сразу меняет его на токен
 * через `POST /auth/exchange` и кладёт токен в httpOnly cookie тем же
 * `setSessionCookie`, что и обычный email/password вход.
 */
@Injectable()
export class OAuthExchangeService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async issue(sessionToken: string): Promise<string> {
    const code = randomBytes(24).toString('hex');
    await this.redis.set(this.key(code), sessionToken, 'EX', EXCHANGE_TTL_SECONDS);
    return code;
  }

  /** Возвращает session-токен и немедленно удаляет код — повторно
   * использовать нельзя (тот же принцип, что у `SocketTicketsService.consume`). */
  async consume(code: string): Promise<string | null> {
    const key = this.key(code);
    const token = await this.redis.get(key);
    if (token !== null) {
      await this.redis.del(key);
    }
    return token;
  }

  private key(code: string): string {
    return `${EXCHANGE_KEY_PREFIX}${code}`;
  }
}
