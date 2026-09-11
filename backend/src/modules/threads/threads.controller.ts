import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { createChatAttachmentMulterOptions } from '@/common/lib/upload';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { RealtimeGateway } from '@/infrastructure/websocket/realtime.gateway';
import { EditMessageDto } from './dto/edit-message.dto';
import { ForwardMessageDto } from './dto/forward-message.dto';
import { SendMessageDto } from './dto/send-message.dto';
import type { MessageDto, ThreadDto } from './threads.types';
import { ThreadsService, type ThreadSearchResult } from './threads.service';

/** До 5 файлов на сообщение — сообщения лёгкие по своей природе, в отличие
 * от поста с MAX_POST_IMAGES=10; тот же принцип потолка на уровне
 * multer/интерсептора, что и у постов. */
const MAX_MESSAGE_FILES = 5;

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

  /** Поиск по ВСЕМ тредам текущего пользователя — до `:id/messages/search`
   * ниже намеренно не пересекается по маршруту (разное число сегментов
   * пути), порядок объявления роли не играет. */
  @Get('search')
  async searchAcrossThreads(
    @CurrentUser() currentUser: RequestUser,
    @Query('q') q: string,
  ): Promise<ThreadSearchResult[]> {
    return this.threadsService.searchAcrossThreads(currentUser.id, q ?? '');
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

  @Get(':id/messages/search')
  async searchInThread(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') threadId: string,
    @Query('q') q: string,
  ): Promise<MessageDto[]> {
    return this.threadsService.searchInThread(threadId, currentUser.id, q ?? '');
  }

  @Post(':id/messages')
  @UseInterceptors(
    FilesInterceptor('files', MAX_MESSAGE_FILES, createChatAttachmentMulterOptions()),
  )
  async sendMessage(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') threadId: string,
    @Body() dto: SendMessageDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<MessageDto> {
    const { message, participantUserIds } = await this.threadsService.sendMessage(
      threadId,
      currentUser.id,
      dto,
      files ?? [],
    );
    await this.broadcastMessage('message:new', message, currentUser.id, participantUserIds);
    return message;
  }

  @Patch(':id/messages/:messageId')
  async editMessage(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') threadId: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ): Promise<MessageDto> {
    const { message, participantUserIds } = await this.threadsService.editMessage(
      threadId,
      messageId,
      currentUser.id,
      dto,
    );
    await this.broadcastMessage('message:edited', message, currentUser.id, participantUserIds);
    return message;
  }

  @Delete(':id/messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMessage(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') threadId: string,
    @Param('messageId') messageId: string,
  ): Promise<void> {
    const { participantUserIds } = await this.threadsService.deleteMessage(
      threadId,
      messageId,
      currentUser.id,
    );
    this.realtimeGateway.emitToUsers(participantUserIds, 'message:deleted', {
      threadId,
      messageId,
    });
  }

  @Post(':id/messages/:messageId/forward')
  async forwardMessage(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') threadId: string,
    @Param('messageId') messageId: string,
    @Body() dto: ForwardMessageDto,
  ): Promise<MessageDto> {
    const { message, participantUserIds } = await this.threadsService.forwardMessage(
      threadId,
      messageId,
      currentUser.id,
      dto.targetThreadId,
    );
    // То же событие, что и у обычной отправки — получателю нет разницы,
    // переслали сообщение или написали заново, `forwardedFrom` в самом
    // `MessageDto` уже несёт всё нужное для рендера.
    await this.broadcastMessage('message:new', message, currentUser.id, participantUserIds);
    return message;
  }

  @Patch(':id/messages/:messageId/pin')
  async pinMessage(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') threadId: string,
    @Param('messageId') messageId: string,
  ): Promise<ThreadDto> {
    const { thread, participantUserIds } = await this.threadsService.pinMessage(
      threadId,
      messageId,
      currentUser.id,
    );
    await this.broadcastThread('thread:pinned-changed', thread, currentUser.id, participantUserIds);
    return thread;
  }

  @Patch(':id/messages/:messageId/unpin')
  async unpinMessage(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') threadId: string,
    @Param('messageId') messageId: string,
  ): Promise<ThreadDto> {
    const { thread, participantUserIds } = await this.threadsService.unpinMessage(
      threadId,
      messageId,
      currentUser.id,
    );
    await this.broadcastThread('thread:pinned-changed', thread, currentUser.id, participantUserIds);
    return thread;
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') threadId: string,
  ): Promise<void> {
    await this.threadsService.markRead(threadId, currentUser.id);
  }

  /** Рассылка `MessageDto` участникам треда — НЕ один и тот же объект всем
   * (в отличие от прежнего поведения до §104): `sharedPost` внутри
   * `MessageDto` — per-viewer (см. `ThreadsService.toMessageDto`'s
   * комментарий), так что каждый получатель, кроме уже посчитанного actor'а
   * (он получает уже готовый `senderDto`, второй раз не пересчитываем),
   * получает собственный пересчитанный DTO. */
  private async broadcastMessage(
    event: 'message:new' | 'message:edited',
    actorDto: MessageDto,
    actorId: string,
    participantUserIds: string[],
  ): Promise<void> {
    await Promise.all(
      participantUserIds.map(async (participantId) => {
        const dto =
          participantId === actorId
            ? actorDto
            : await this.threadsService.getMessageDtoForViewer(actorDto.id, participantId);
        this.realtimeGateway.emitToUser(participantId, event, dto);
      }),
    );
  }

  /** То же самое, но для `ThreadDto` целиком (закреп/откреп — `thread:
   * pinned-changed` несёт весь список сообщений треда, включая их
   * `sharedPost`, тот же per-viewer случай, что у `broadcastMessage`). */
  private async broadcastThread(
    event: 'thread:pinned-changed',
    actorDto: ThreadDto,
    actorId: string,
    participantUserIds: string[],
  ): Promise<void> {
    await Promise.all(
      participantUserIds.map(async (participantId) => {
        const dto =
          participantId === actorId
            ? actorDto
            : await this.threadsService.getThreadDtoForViewer(actorDto.id, participantId);
        this.realtimeGateway.emitToUser(participantId, event, dto);
      }),
    );
  }
}
