import { Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PresenceService } from '@/infrastructure/redis/presence.service';
import { SocketTicketsService } from '@/infrastructure/redis/socket-tickets.service';

interface SocketData {
  userId: string;
}

/**
 * Единственный Socket.IO-шлюз приложения — не привязан к конкретному
 * домену (сообщения, заявки в друзья и т. п.), только доставляет события в
 * комнату пользователя. Не принимает бизнес-событий от клиента — все записи
 * идут через REST (Controller → Service → `emitToUser(s)`), чтобы не
 * дублировать валидацию/бизнес-логику между HTTP и WS (см. AGENTS.md backend,
 * раздел про real-time).
 *
 * Аутентификация — одноразовый билет (`SocketTicketsService`), а не
 * сессионный токен: браузер никогда не получает основной session-токен в JS.
 * Билет одноразовый и намеренно недолговечный — frontend обязан запрашивать
 * новый билет на каждую попытку подключения (включая автоматический
 * reconnect Socket.IO), иначе reconnect после любого разрыва соединения
 * будет молча и навсегда падать с уже использованным билетом.
 *
 * `cors.origin` читается из `process.env` напрямую (не через ConfigService):
 * значение декоратора вычисляется при загрузке модуля, до того как Nest
 * поднимет DI-контейнер.
 */
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly socketTicketsService: SocketTicketsService,
    private readonly presenceService: PresenceService,
  ) {}

  /** Шлюз только что (пере)создан — ни у одного реального клиента ещё нет
   * живого соединения с этим процессом, поэтому любой накопленный в Redis
   * presence-счётчик заведомо устарел (см. `PresenceService.resetAll`). */
  async afterInit(): Promise<void> {
    await this.presenceService.resetAll();
    this.logger.log('Presence сброшен при старте шлюза');
  }

  async handleConnection(client: Socket): Promise<void> {
    const ticket = client.handshake.auth?.ticket as string | undefined;
    const userId = ticket ? await this.socketTicketsService.consume(ticket) : null;

    if (!userId) {
      this.logger.warn(`Отклонено соединение без валидного билета: ${client.id}`);
      client.disconnect(true);
      return;
    }

    (client.data as SocketData).userId = userId;
    await client.join(this.userRoom(userId));
    await this.presenceService.addConnection(userId);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = (client.data as Partial<SocketData>).userId;
    if (userId) {
      await this.presenceService.removeConnection(userId);
    }
  }

  /** Отправляет событие в комнату одного пользователя (все его вкладки/устройства). */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(this.userRoom(userId)).emit(event, payload);
  }

  /** То же самое для нескольких получателей — например, все участники диалога. */
  emitToUsers(userIds: string[], event: string, payload: unknown): void {
    userIds.forEach((userId) => this.emitToUser(userId, event, payload));
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
