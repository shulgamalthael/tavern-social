import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';
import type { AppConfig } from '@/config/configuration';

type RedisAdapterConstructor = ReturnType<typeof createAdapter>;

/**
 * Socket.IO adapter backed by Redis pub/sub. Единственный instance backend
 * в dev-окружении обходится и без него, но при масштабировании (несколько
 * реплик backend) без Redis-адаптера сообщения не долетали бы до сокетов,
 * подключённых к другой реплике — настраиваем сразу, чтобы не переделывать
 * позже.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: RedisAdapterConstructor;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  connectToRedis(): void {
    const configService = this.app.get(ConfigService);
    const redisUrl = configService.get<AppConfig>('app')!.redisUrl;

    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
