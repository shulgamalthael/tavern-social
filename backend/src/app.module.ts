import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { RealtimeModule } from './infrastructure/websocket/realtime.module';
import { AuthModule } from './modules/auth/auth.module';
import { CommunitiesModule } from './modules/communities/communities.module';
import { FriendsModule } from './modules/friends/friends.module';
import { GroupsModule } from './modules/groups/groups.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PostsModule } from './modules/posts/posts.module';
import { SearchModule } from './modules/search/search.module';
import { ThreadsModule } from './modules/threads/threads.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
    PrismaModule,
    RedisModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    NotificationsModule,
    PostsModule,
    ThreadsModule,
    FriendsModule,
    CommunitiesModule,
    GroupsModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
