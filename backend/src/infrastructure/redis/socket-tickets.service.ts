import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import type { AppConfig } from '@/config/configuration';
import { REDIS_CLIENT } from './redis-client.provider';

const TICKET_KEY_PREFIX = 'socket-ticket:';

/**
 * Одноразовый короткоживущий билет для установления Socket.IO-соединения.
 * Браузер не получает основной session-токен (он остаётся только в httpOnly
 * cookie на стороне Next.js) — вместо этого Server Action на фронтенде
 * запрашивает такой билет и передаёт его клиентскому сокету. Билет
 * действителен один раз и всего SOCKET_TICKET_TTL_SECONDS секунд — утечка
 * такого билета не даёт доступа к REST API, только к WS-соединению.
 */
@Injectable()
export class SocketTicketsService {
  private readonly ttlSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    configService: ConfigService,
  ) {
    this.ttlSeconds = configService.get<AppConfig>('app')!.socketTicketTtlSeconds;
  }

  async issue(userId: string): Promise<string> {
    const ticket = randomBytes(24).toString('hex');
    await this.redis.set(this.key(ticket), userId, 'EX', this.ttlSeconds);
    return ticket;
  }

  /** Возвращает userId и немедленно удаляет билет — повторно использовать нельзя. */
  async consume(ticket: string): Promise<string | null> {
    const key = this.key(ticket);
    const userId = await this.redis.get(key);
    if (userId) {
      await this.redis.del(key);
    }
    return userId;
  }

  private key(ticket: string): string {
    return `${TICKET_KEY_PREFIX}${ticket}`;
  }
}
