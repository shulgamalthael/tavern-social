import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import type { AppConfig } from '@/config/configuration';
import { REDIS_CLIENT } from './redis-client.provider';

const SESSION_KEY_PREFIX = 'session:';

/**
 * Сессии — не JWT, а непрозрачный случайный токен, ключ к записи в Redis
 * (session:<token> -> userId, TTL). Такой выбор сделан осознанно вместо JWT:
 * не нужна ротация/подпись, отзыв — обычный DEL, а не blacklist. Backend —
 * единственный источник истины по сессии; frontend только хранит токен в
 * httpOnly cookie и никогда не читает его содержимое напрямую (см.
 * PROJECT_CONTEXT.md backend, раздел «Auth»).
 */
@Injectable()
export class SessionsService {
  private readonly ttlSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    configService: ConfigService,
  ) {
    this.ttlSeconds = configService.get<AppConfig>('app')!.sessionTtlSeconds;
  }

  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.redis.set(this.key(token), userId, 'EX', this.ttlSeconds);
    return token;
  }

  async resolve(token: string): Promise<string | null> {
    return this.redis.get(this.key(token));
  }

  /** Продлевает TTL при активности — сессия не «сгорает» посреди использования. */
  async touch(token: string): Promise<void> {
    await this.redis.expire(this.key(token), this.ttlSeconds);
  }

  async revoke(token: string): Promise<void> {
    await this.redis.del(this.key(token));
  }

  private key(token: string): string {
    return `${SESSION_KEY_PREFIX}${token}`;
  }
}
