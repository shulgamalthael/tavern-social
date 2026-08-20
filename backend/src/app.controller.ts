import { Controller, Get, Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from './infrastructure/database/prisma.service';
import { REDIS_CLIENT } from './infrastructure/redis/redis-client.provider';

/** Используется Docker healthcheck (docker-compose) и локальной проверкой при старте. */
@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('health')
  async health(): Promise<{ status: 'ok'; database: boolean; redis: boolean }> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    return { status: 'ok', database, redis };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}
