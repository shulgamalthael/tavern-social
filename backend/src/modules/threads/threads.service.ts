import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Message,
  MessageAttachment,
  Prisma,
  Thread,
  ThreadParticipant,
  User,
} from '@prisma/client';
import { deleteUploadedFile, uploadedFileUrl } from '@/common/lib/upload';
import { pluralizeRu } from '@/common/lib/pluralize-ru';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PresenceService } from '@/infrastructure/redis/presence.service';
import { PostsService } from '@/modules/posts/posts.service';
import type { PublicProfile } from '@/modules/users/users.types';
import { UsersService } from '@/modules/users/users.service';
import type { EditMessageDto } from './dto/edit-message.dto';
import type { SendMessageDto } from './dto/send-message.dto';
import type { ForwardedFromDto, MessageDto, ReplyToDto, ThreadDto } from './threads.types';

/** Общий `include` для всех мест, где сообщение уходит наружу как `MessageDto`
 * — один источник формы вместо копирования `include` в каждый запрос. */
const MESSAGE_INCLUDE = {
  attachments: { orderBy: { order: 'asc' } },
  forwardedFrom: { include: { sender: true } },
  replyTo: { include: { sender: true, attachments: true } },
} satisfies Prisma.MessageInclude;

type MessageWithRelations = Message & {
  attachments: MessageAttachment[];
  forwardedFrom: (Message & { sender: User }) | null;
  replyTo: (Message & { sender: User; attachments: MessageAttachment[] }) | null;
};

type ParticipantWithUser = ThreadParticipant & { user: User };
type ThreadWithParticipantsAndMessages = Thread & {
  participants: ParticipantWithUser[];
  messages: MessageWithRelations[];
};

export interface SentMessage {
  message: MessageDto;
  /** Все участники диалога — получатели socket-события `message:new`. */
  participantUserIds: string[];
}

export interface ParticipantAdded {
  /** DTO диалога с точки зрения того, кто добавил участника. */
  thread: ThreadDto;
  /** Все участники диалога, включая нового — получатели socket-события
   * `thread:participant-added`. */
  participantUserIds: string[];
  newParticipant: PublicProfile;
}

export interface PinnedChanged {
  thread: ThreadDto;
  participantUserIds: string[];
}

export interface MessageDeleted {
  threadId: string;
  messageId: string;
  participantUserIds: string[];
}

export interface ThreadSearchResult {
  threadId: string;
  messages: MessageDto[];
}

@Injectable()
export class ThreadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceService: PresenceService,
    private readonly usersService: UsersService,
    private readonly postsService: PostsService,
  ) {}

  async listForUser(userId: string): Promise<ThreadDto[]> {
    const threads = await this.prisma.thread.findMany({
      where: { participants: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: { include: { user: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: MESSAGE_INCLUDE },
      },
    });

    return Promise.all(threads.map((thread) => this.toDto(thread, userId)));
  }

  async getOrCreateDirectThread(userId: string, otherUserId: string): Promise<ThreadDto> {
    if (userId === otherUserId) {
      throw new BadRequestException('Нельзя открыть диалог с самим собой');
    }
    await this.usersService.findByIdOrThrow(otherUserId);

    const existing = await this.prisma.thread.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: otherUserId } } },
        ],
      },
      include: {
        participants: { include: { user: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: MESSAGE_INCLUDE },
      },
    });

    if (existing) {
      return this.toDto(existing, userId);
    }

    const created = await this.prisma.thread.create({
      data: {
        participants: {
          create: [{ userId }, { userId: otherUserId }],
        },
      },
      include: {
        participants: { include: { user: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: MESSAGE_INCLUDE },
      },
    });

    return this.toDto(created, userId);
  }

  /**
   * Добавляет участника к разговору с текущими собеседниками из `threadId`.
   * Личная переписка (1:1) не превращается в групповую этим действием — она
   * остаётся как есть, а участник дописывается в НОВЫЙ Thread с тем же
   * составом + новым человеком (личка не портится, если потом захочется
   * снова написать один на один). Уже групповой диалог (3+, включая
   * добавленных ранее), наоборот, просто дополняется на месте — вот почему
   * повторные добавления в уже созданную группу не плодят дублирующие Thread.
   */
  async addParticipant(
    threadId: string,
    requesterId: string,
    newUserId: string,
  ): Promise<ParticipantAdded> {
    if (requesterId === newUserId) {
      throw new BadRequestException('Нельзя добавить самого себя');
    }
    const participants = await this.assertParticipant(threadId, requesterId);
    if (participants.some((participant) => participant.userId === newUserId)) {
      throw new BadRequestException('Этот пользователь уже участвует в диалоге');
    }
    await this.usersService.findByIdOrThrow(newUserId);

    const isDirect = participants.length === 2;
    const thread = isDirect
      ? await this.createGroupFrom(participants, newUserId)
      : await this.addToExistingThread(threadId, newUserId);

    const newParticipantRow = thread.participants.find(
      (participant) => participant.userId === newUserId,
    );
    if (!newParticipantRow) {
      throw new NotFoundException('Диалог повреждён: новый участник не найден');
    }

    return {
      thread: await this.toDto(thread, requesterId),
      participantUserIds: thread.participants.map((participant) => participant.userId),
      newParticipant: this.usersService.toPublicProfile(newParticipantRow.user),
    };
  }

  private async createGroupFrom(
    currentParticipants: ThreadParticipant[],
    newUserId: string,
  ): Promise<ThreadWithParticipantsAndMessages> {
    return this.prisma.thread.create({
      data: {
        participants: {
          create: [
            ...currentParticipants.map((participant) => ({ userId: participant.userId })),
            { userId: newUserId },
          ],
        },
      },
      include: {
        participants: { include: { user: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: MESSAGE_INCLUDE },
      },
    });
  }

  private async addToExistingThread(
    threadId: string,
    newUserId: string,
  ): Promise<ThreadWithParticipantsAndMessages> {
    await this.prisma.$transaction([
      this.prisma.threadParticipant.create({ data: { threadId, userId: newUserId } }),
      this.prisma.thread.update({ where: { id: threadId }, data: { updatedAt: new Date() } }),
    ]);
    return this.prisma.thread.findUniqueOrThrow({
      where: { id: threadId },
      include: {
        participants: { include: { user: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: MESSAGE_INCLUDE },
      },
    });
  }

  async sendMessage(
    threadId: string,
    senderId: string,
    dto: SendMessageDto,
    files: Express.Multer.File[],
  ): Promise<SentMessage> {
    const participants = await this.assertParticipant(threadId, senderId);
    const text = dto.text?.trim() ?? '';
    if (!text && files.length === 0 && !dto.sharedPostId) {
      throw new BadRequestException('Сообщение должно содержать текст, вложение или запись');
    }
    // Отвечать можно только на сообщение из этого же треда — иначе цитата
    // вела бы на чужой, недоступный этому диалогу текст.
    if (dto.replyToId) {
      await this.assertMessageInThread(threadId, dto.replyToId);
    }
    // Поделиться постом можно только тем, что сам сейчас видишь — та же
    // логика, что доступ к посту напрямую (§103/§104), просто без throw
    // внутри `getShareSummary`: здесь решаем сами, чем это оборачивается.
    if (dto.sharedPostId) {
      const shareSummary = await this.postsService.getShareSummary(dto.sharedPostId, senderId);
      if (shareSummary.status !== 'visible') {
        throw new NotFoundException('Запись не найдена');
      }
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          threadId,
          senderId,
          text,
          replyToId: dto.replyToId,
          sharedPostId: dto.sharedPostId,
          attachments: {
            create: files.map((file, index) => ({
              url: uploadedFileUrl('messages', file.filename),
              mimeType: file.mimetype,
              fileName: file.originalname,
              sizeBytes: file.size,
              order: index,
            })),
          },
        },
        include: MESSAGE_INCLUDE,
      });
      await tx.thread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
      await tx.threadParticipant.update({
        where: { threadId_userId: { threadId, userId: senderId } },
        data: { lastReadAt: created.createdAt },
      });
      return created;
    });

    return {
      message: await this.toMessageDto(message, senderId),
      participantUserIds: participants.map((participant) => participant.userId),
    };
  }

  /** Редактирование текста — только своё сообщение, только текст (вложения
   * менять нельзя, тот же выбор, что у большинства чатов: убрать/добавить
   * файл — это, по сути, другое сообщение). */
  async editMessage(
    threadId: string,
    messageId: string,
    userId: string,
    dto: EditMessageDto,
  ): Promise<SentMessage> {
    const participants = await this.assertParticipant(threadId, userId);
    const existing = await this.assertMessageInThread(threadId, messageId);
    if (existing.senderId !== userId) {
      throw new ForbiddenException('Можно редактировать только своё сообщение');
    }

    // `@Length(1, 2000)` в `EditMessageDto` пропускает строку из одних
    // пробелов — тримим и перепроверяем здесь же, тем же правилом, что и
    // `sendMessage`, иначе сообщение можно отредактировать в фактически
    // пустое в обход общего «текст или вложение» (вложения при редактировании
    // не меняются, так что пустой текст оставил бы сообщение без содержимого).
    const text = dto.text.trim();
    if (!text) {
      throw new BadRequestException('Текст сообщения не может быть пустым');
    }

    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: { text, editedAt: new Date() },
      include: MESSAGE_INCLUDE,
    });

    return {
      message: await this.toMessageDto(message, userId),
      participantUserIds: participants.map((participant) => participant.userId),
    };
  }

  /**
   * Удаление — только своё сообщение (в отличие от постов, здесь нет
   * модераторского удаления чужих: сообщения видны только участникам
   * диалога, а не всему залу, так что у обычной переписки нет той же
   * потребности в модерации, что у публичной ленты). Жёсткое удаление
   * строки (тот же выбор, что `PostsService.remove` — без плейсхолдера
   * «сообщение удалено»), вложения на диске подчищаются отдельно: каскад в
   * схеме удаляет только строки `MessageAttachment`, не сами файлы.
   * Ответы/пересылки, ссылавшиеся на это сообщение (`replyToId`/
   * `forwardedFromId`), не удаляются вместе с ним — `onDelete: SetNull` в
   * схеме просто обнуляет ссылку, они остаются в своей истории.
   */
  async deleteMessage(
    threadId: string,
    messageId: string,
    userId: string,
  ): Promise<MessageDeleted> {
    const participants = await this.assertParticipant(threadId, userId);
    const existing = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { attachments: true },
    });
    if (!existing || existing.threadId !== threadId) {
      throw new NotFoundException('Сообщение не найдено');
    }
    if (existing.senderId !== userId) {
      throw new ForbiddenException('Можно удалить только своё сообщение');
    }

    await this.prisma.message.delete({ where: { id: messageId } });
    for (const attachment of existing.attachments) {
      deleteUploadedFile(attachment.url);
    }

    return {
      threadId,
      messageId,
      participantUserIds: participants.map((participant) => participant.userId),
    };
  }

  /**
   * Пересылка — отдельная запись `Message` в целевом треде, ссылающаяся на
   * оригинал через `forwardedFromId` (тот же принцип, что репост поста), а
   * не перемещение исходного сообщения. Текст снимается на момент пересылки
   * (не живая ссылка на оригинал) — если оригинал потом отредактируют,
   * пересланная копия не должна тихо поменяться вместе с ним.
   */
  async forwardMessage(
    sourceThreadId: string,
    messageId: string,
    userId: string,
    targetThreadId: string,
  ): Promise<SentMessage> {
    await this.assertParticipant(sourceThreadId, userId);
    const original = await this.assertMessageInThread(sourceThreadId, messageId);
    const targetParticipants = await this.assertParticipant(targetThreadId, userId);

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          threadId: targetThreadId,
          senderId: userId,
          text: original.text,
          forwardedFromId: original.id,
          // Если пересылаемое сообщение само несёт шаренный пост — уносим
          // ссылку дальше (иначе форвард «съедал» бы вложенную запись).
          // Отдельной проверки доступа здесь не нужно: видимость
          // пересчитывается per-viewer на каждом чтении (`getShareSummary`),
          // независимо от того, как sharedPostId попал в это сообщение.
          sharedPostId: original.sharedPostId,
        },
        include: MESSAGE_INCLUDE,
      });
      await tx.thread.update({ where: { id: targetThreadId }, data: { updatedAt: new Date() } });
      await tx.threadParticipant.update({
        where: { threadId_userId: { threadId: targetThreadId, userId } },
        data: { lastReadAt: created.createdAt },
      });
      return created;
    });

    return {
      message: await this.toMessageDto(message, userId),
      participantUserIds: targetParticipants.map((participant) => participant.userId),
    };
  }

  async pinMessage(threadId: string, messageId: string, userId: string): Promise<PinnedChanged> {
    return this.setPinned(threadId, messageId, userId, new Date());
  }

  async unpinMessage(threadId: string, messageId: string, userId: string): Promise<PinnedChanged> {
    return this.setPinned(threadId, messageId, userId, null);
  }

  private async setPinned(
    threadId: string,
    messageId: string,
    userId: string,
    pinnedAt: Date | null,
  ): Promise<PinnedChanged> {
    await this.assertParticipant(threadId, userId);
    await this.assertMessageInThread(threadId, messageId);

    await this.prisma.message.update({ where: { id: messageId }, data: { pinnedAt } });

    const thread = await this.prisma.thread.findUniqueOrThrow({
      where: { id: threadId },
      include: {
        participants: { include: { user: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: MESSAGE_INCLUDE },
      },
    });

    return {
      thread: await this.toDto(thread, userId),
      participantUserIds: thread.participants.map((participant) => participant.userId),
    };
  }

  /** Поиск по одному треду — только для его участника, без пагинации:
   * список сообщений в треде и так не постраничный (см. `listForUser`). */
  async searchInThread(threadId: string, userId: string, q: string): Promise<MessageDto[]> {
    await this.assertParticipant(threadId, userId);
    const messages = await this.prisma.message.findMany({
      where: { threadId, text: { contains: q, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      include: MESSAGE_INCLUDE,
    });
    return Promise.all(messages.map((message) => this.toMessageDto(message, userId)));
  }

  /** Поиск по всем тредам пользователя разом — сгруппировано по треду,
   * frontend уже знает имена/аватары тредов из своего стора (см.
   * `entities/thread`), сюда их дублировать незачем. */
  async searchAcrossThreads(userId: string, q: string): Promise<ThreadSearchResult[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        thread: { participants: { some: { userId } } },
        text: { contains: q, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      include: MESSAGE_INCLUDE,
    });

    const byThread = new Map<string, MessageDto[]>();
    for (const message of messages) {
      const bucket = byThread.get(message.threadId) ?? [];
      bucket.push(await this.toMessageDto(message, userId));
      byThread.set(message.threadId, bucket);
    }

    return Array.from(byThread.entries()).map(([threadId, threadMessages]) => ({
      threadId,
      messages: threadMessages,
    }));
  }

  async markRead(threadId: string, userId: string): Promise<void> {
    await this.assertParticipant(threadId, userId);
    await this.prisma.threadParticipant.update({
      where: { threadId_userId: { threadId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  private async assertParticipant(threadId: string, userId: string): Promise<ThreadParticipant[]> {
    const thread = await this.prisma.thread.findUnique({
      where: { id: threadId },
      include: { participants: true },
    });
    if (!thread) {
      throw new NotFoundException('Диалог не найден');
    }
    const isParticipant = thread.participants.some((participant) => participant.userId === userId);
    if (!isParticipant) {
      throw new ForbiddenException('Вы не участник этого диалога');
    }
    return thread.participants;
  }

  private async assertMessageInThread(threadId: string, messageId: string): Promise<Message> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.threadId !== threadId) {
      throw new NotFoundException('Сообщение не найдено');
    }
    return message;
  }

  private async toDto(
    thread: ThreadWithParticipantsAndMessages,
    userId: string,
  ): Promise<ThreadDto> {
    const me = thread.participants.find((participant) => participant.userId === userId);
    const others = thread.participants.filter((participant) => participant.userId !== userId);

    // Участник без хотя бы одного собеседника означал бы повреждённые
    // данные (диалог сам с собой не создаётся, см. getOrCreateDirectThread/
    // addParticipant), а не ожидаемый пустой список.
    if (!me || others.length === 0) {
      throw new NotFoundException('Диалог повреждён: не найдены собеседники');
    }

    const isGroup = others.length > 1;
    const status = isGroup
      ? `${others.length} ${pluralizeRu(others.length, ['участник', 'участника', 'участников'])}`
      : (await this.presenceService.isOnline(others[0].userId))
        ? 'здесь'
        : 'не в зале сейчас';

    const unreadCount = thread.messages.filter(
      (message) => message.senderId !== userId && message.createdAt > me.lastReadAt,
    ).length;

    const messages = await Promise.all(
      thread.messages.map((message) => this.toMessageDto(message, userId)),
    );

    return {
      id: thread.id,
      participants: others.map((participant) =>
        this.usersService.toPublicProfile(participant.user),
      ),
      isGroup,
      status,
      unreadCount,
      messages,
      pinnedMessages: messages
        .filter((message) => message.pinnedAt)
        .sort((a, b) => (a.pinnedAt! < b.pinnedAt! ? 1 : -1)),
    };
  }

  /** `viewerId` — тот, для кого собирается DTO: в отличие от
   * `forwardedFrom`/`replyTo` (одинаковы для всех, кто вообще видит
   * сообщение — тред уже сам по себе ограничивает видимость участниками),
   * `sharedPost` — per-viewer (§104, `SharedPostDto`'s комментарий), поэтому
   * этот метод больше нельзя вызывать один раз и рассылать результат всем
   * участникам не глядя — см. `ThreadsController`'s рассылку `message:new`/
   * `message:edited`. */
  private async toMessageDto(message: MessageWithRelations, viewerId: string): Promise<MessageDto> {
    const forwardedFrom: ForwardedFromDto | null = message.forwardedFrom
      ? {
          id: message.forwardedFrom.id,
          senderId: message.forwardedFrom.senderId,
          senderName: message.forwardedFrom.sender.name,
        }
      : null;

    const replyTo: ReplyToDto | null = message.replyTo
      ? {
          id: message.replyTo.id,
          senderId: message.replyTo.senderId,
          senderName: message.replyTo.sender.name,
          text: message.replyTo.text,
          hasAttachment: message.replyTo.attachments.length > 0,
        }
      : null;

    const sharedPost = message.sharedPostId
      ? await this.postsService.getShareSummary(message.sharedPostId, viewerId)
      : null;

    return {
      id: message.id,
      threadId: message.threadId,
      senderId: message.senderId,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
      editedAt: message.editedAt?.toISOString() ?? null,
      pinnedAt: message.pinnedAt?.toISOString() ?? null,
      attachments: message.attachments.map((attachment) => ({
        id: attachment.id,
        url: attachment.url,
        mimeType: attachment.mimeType,
        fileName: attachment.fileName,
        sizeBytes: attachment.sizeBytes,
      })),
      forwardedFrom,
      replyTo,
      sharedPost,
    };
  }

  /** Публичный, единственная точка для `ThreadsController` — пересчитать
   * `MessageDto` уже отправленного/отредактированного сообщения для
   * КОНКРЕТНОГО получателя при realtime-рассылке (`message:new`/
   * `message:edited`), а не разослать всем один и тот же объект — см.
   * `toMessageDto`'s комментарий про `sharedPost`. */
  async getMessageDtoForViewer(messageId: string, viewerId: string): Promise<MessageDto> {
    const message = await this.prisma.message.findUniqueOrThrow({
      where: { id: messageId },
      include: MESSAGE_INCLUDE,
    });
    return this.toMessageDto(message, viewerId);
  }

  /** То же самое, но для целого треда (закреп/откреп сообщения — см.
   * `ThreadsController.broadcastThread`'s комментарий). */
  async getThreadDtoForViewer(threadId: string, viewerId: string): Promise<ThreadDto> {
    const thread = await this.prisma.thread.findUniqueOrThrow({
      where: { id: threadId },
      include: {
        participants: { include: { user: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: MESSAGE_INCLUDE },
      },
    });
    return this.toDto(thread, viewerId);
  }
}
