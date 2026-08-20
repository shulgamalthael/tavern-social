import { Module } from '@nestjs/common';
import { UsersModule } from '@/modules/users/users.module';
import { ThreadsController } from './threads.controller';
import { ThreadsService } from './threads.service';

@Module({
  imports: [UsersModule],
  controllers: [ThreadsController],
  providers: [ThreadsService],
})
export class ThreadsModule {}
