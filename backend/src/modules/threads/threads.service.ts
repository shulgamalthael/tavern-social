import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Message, Thread, ThreadParticipant, User } from '@prisma/client';
import { pluralizeRu } from '@/common/lib/pluralize-ru';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PresenceService } from '@/infrastructure/redis/presence.service';
import type { PublicProfile } from '@/modules/users/users.types';
import { UsersService } from '@/modules/users/users.service';
import type { SendMessageDto } from './dto/send-message.dto';
import type { MessageDto, ThreadDto } from './threads.types';

type ParticipantWithUser = ThreadParticipant & { user: User };
type ThreadWithParticipantsAndMessages = Thread & {
  participants: ParticipantWithUser[];
  messages: Message[];
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

@Injectable()
export class ThreadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceService: PresenceService,
    private readonly usersService: UsersService,
  ) {}

  async listForUser(userId: string): Promise<ThreadDto[]> {
    const threads = await this.prisma.thread.findMany({
      where: { participants: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: { include: { user: true } },
        messages: { orderBy: { createdAt: 'asc' } },
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
        messages: { orderBy: { createdAt: 'asc' } },
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
        messages: { orderBy: { createdAt: 'asc' } },
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
        messages: { orderBy: { createdAt: 'asc' } },
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
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async sendMessage(threadId: string, senderId: string, dto: SendMessageDto): Promise<SentMessage> {
    const participants = await this.assertParticipant(threadId, senderId);

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { threadId, senderId, text: dto.text },
      });
      await tx.thread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
      await tx.threadParticipant.update({
        where: { threadId_userId: { threadId, userId: senderId } },
        data: { lastReadAt: created.createdAt },
      });
      return created;
    });

    return {
      message: this.toMessageDto(message),
      participantUserIds: participants.map((participant) => participant.userId),
    };
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

    return {
      id: thread.id,
      participants: others.map((participant) =>
        this.usersService.toPublicProfile(participant.user),
      ),
      isGroup,
      status,
      unreadCount,
      messages: thread.messages.map((message) => this.toMessageDto(message)),
    };
  }

  private toMessageDto(message: Message): MessageDto {
    return {
      id: message.id,
      threadId: message.threadId,
      senderId: message.senderId,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
