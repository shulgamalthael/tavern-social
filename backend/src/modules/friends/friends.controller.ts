import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import type { PaginatedDto } from '@/common/types/paginated';
import { RealtimeGateway } from '@/infrastructure/websocket/realtime.gateway';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import type { FriendDto, FriendRequestsListDto, FriendshipStatusDto } from './friends.types';
import { FriendsService } from './friends.service';

@Controller('friends')
@UseGuards(SessionAuthGuard)
export class FriendsController {
  constructor(
    private readonly friendsService: FriendsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  async list(
    @CurrentUser() currentUser: RequestUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedDto<FriendDto>> {
    return this.friendsService.list(currentUser.id, query.cursor, query.limit);
  }

  @Get('requests')
  async listRequests(@CurrentUser() currentUser: RequestUser): Promise<FriendRequestsListDto> {
    return this.friendsService.listRequests(currentUser.id);
  }

  @Post('requests/:userId')
  async sendRequest(
    @CurrentUser() currentUser: RequestUser,
    @Param('userId') userId: string,
  ): Promise<FriendshipStatusDto> {
    const { status, outcome } = await this.friendsService.sendRequest(currentUser.id, userId);

    if (outcome === 'request-created') {
      const { id: notificationId, actor } = await this.notificationsService.notifyFriendRequest(
        userId,
        currentUser.id,
      );
      this.realtimeGateway.emitToUser(userId, 'friend-request:new', { notificationId, actor });
    } else if (outcome === 'auto-accepted') {
      // Получатель (userId) — это тот, кто отправил мне встречную заявку раньше,
      // и она только что автоматически подтвердилась.
      const { id: notificationId, actor } = await this.notificationsService.notifyFriendAccepted(
        userId,
        currentUser.id,
      );
      this.realtimeGateway.emitToUser(userId, 'friend-request:accepted', {
        notificationId,
        actor,
      });
    }

    return status;
  }

  // Разрыв уже подтверждённой дружбы — отдельный маршрут от `requests/:userId`
  // (отмена/отклонение ещё не подтверждённой заявки), не конфликтует с ним:
  // разная форма пути под одним и тем же DELETE.
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFriend(
    @CurrentUser() currentUser: RequestUser,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.friendsService.removeFriend(currentUser.id, userId);
    this.realtimeGateway.emitToUser(userId, 'friend:removed', { userId: currentUser.id });
  }

  @Delete('requests/:userId')
  async respondToRequest(
    @CurrentUser() currentUser: RequestUser,
    @Param('userId') userId: string,
  ): Promise<FriendshipStatusDto> {
    const { status, removed } = await this.friendsService.respondToRequest(currentUser.id, userId);

    if (removed) {
      this.realtimeGateway.emitToUser(userId, 'friend-request:removed', {
        userId: currentUser.id,
      });
    }

    return status;
  }

  @Post('requests/:userId/accept')
  async acceptRequest(
    @CurrentUser() currentUser: RequestUser,
    @Param('userId') userId: string,
  ): Promise<FriendshipStatusDto> {
    const status = await this.friendsService.acceptRequest(currentUser.id, userId);

    // userId здесь — исходный отправитель заявки, теперь принятой.
    const { id: notificationId, actor } = await this.notificationsService.notifyFriendAccepted(
      userId,
      currentUser.id,
    );
    this.realtimeGateway.emitToUser(userId, 'friend-request:accepted', { notificationId, actor });

    return status;
  }
}
