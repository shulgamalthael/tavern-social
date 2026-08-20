import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { RealtimeGateway } from '@/infrastructure/websocket/realtime.gateway';
import { SendMessageDto } from './dto/send-message.dto';
import type { MessageDto, ThreadDto } from './threads.types';
import { ThreadsService } from './threads.service';

@Controller('threads')
@UseGuards(SessionAuthGuard)
export class ThreadsController {
  constructor(
    private readonly threadsService: ThreadsService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  @Get()
  async list(@CurrentUser() currentUser: RequestUser): Promise<ThreadDto[]> {
    return this.threadsService.listForUser(currentUser.id);
  }

  @Post('direct/:userId')
  async getOrCreateDirect(
    @CurrentUser() currentUser: RequestUser,
    @Param('userId') otherUserId: string,
  ): Promise<ThreadDto> {
    return this.threadsService.getOrCreateDirectThread(currentUser.id, otherUserId);
  }

  @Post(':id/participants/:userId')
  async addParticipant(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') threadId: string,
    @Param('userId') newUserId: string,
  ): Promise<ThreadDto> {
    const { thread, participantUserIds, newParticipant } = await this.threadsService.addParticipant(
      threadId,
      currentUser.id,
      newUserId,
    );
    // `thread.id`, а не параметр маршрута: для личной переписки (1:1)
    // `addParticipant` не мутирует исходный диалог, а создаёт новый (см.
    // `ThreadsService.addParticipant`) — участников нужно оповестить именно
    // про него. Новому участнику (а для 1:1-случая — и старому тоже) своей
    // копии этого диалога ещё нет: на их клиенте `receiveParticipantAdded`
    // не найдёт threadId в сторе и сам сделает полный `loadThreads()` (см.
    // AGENTS.md, раздел про real-time: минимальный сигнал, а не слепок сущности).
    this.realtimeGateway.emitToUsers(
      participantUserIds.filter((userId) => userId !== currentUser.id),
      'thread:participant-added',
      { threadId: thread.id, participant: newParticipant },
    );
    return thread;
  }

  @Post(':id/messages')
  async sendMessage(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') threadId: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageDto> {
    const { message, participantUserIds } = await this.threadsService.sendMessage(
      threadId,
      currentUser.id,
      dto,
    );
    this.realtimeGateway.emitToUsers(participantUserIds, 'message:new', message);
    return message;
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') threadId: string,
  ): Promise<void> {
    await this.threadsService.markRead(threadId, currentUser.id);
  }
}
