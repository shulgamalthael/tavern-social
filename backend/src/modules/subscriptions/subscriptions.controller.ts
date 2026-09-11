import {
  Controller,
  Delete,
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
import { NotificationsService } from '@/modules/notifications/notifications.service';
import type { SubscriptionRequestsListDto, SubscriptionStatusDto } from './subscriptions.types';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Действия от лица текущего пользователя над целью `:userId` — тот же
 * приём, что `FriendsController`. Статус/счётчики подписки НЕ дублируются
 * здесь отдельными эндпоинтами — они уже вшиты в `GET users/:id`/`me`
 * (см. `UsersController`), тот же приём, что `friendship` там же. Списки
 * подписчиков/подписок чужого профиля — тоже в `UsersController`
 * (`GET users/:id/followers`/`following`), не здесь — зеркалит уже
 * существующий `GET users/:id/friends`. Маршруты `requests/*` (§103) —
 * заявки на подписку к приватному профилю, зеркалят `FriendsController`'s
 * `requests/*`.
 */
@Controller('subscriptions')
@UseGuards(SessionAuthGuard)
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get('requests')
  listRequests(@CurrentUser() currentUser: RequestUser): Promise<SubscriptionRequestsListDto> {
    return this.subscriptionsService.listRequests(currentUser.id);
  }

  @Post(':userId')
  async subscribe(
    @CurrentUser() currentUser: RequestUser,
    @Param('userId') userId: string,
  ): Promise<SubscriptionStatusDto> {
    const { status, outcome } = await this.subscriptionsService.subscribe(currentUser.id, userId);

    if (outcome === 'requested') {
      const { id: notificationId, actor } =
        await this.notificationsService.notifySubscriptionRequest(userId, currentUser.id);
      this.realtimeGateway.emitToUser(userId, 'subscription-request:new', {
        notificationId,
        actor,
      });
    }

    return status;
  }

  @Delete(':userId')
  unsubscribe(
    @CurrentUser() currentUser: RequestUser,
    @Param('userId') userId: string,
  ): Promise<SubscriptionStatusDto> {
    return this.subscriptionsService.unsubscribe(currentUser.id, userId);
  }

  @Post('requests/:userId/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  async acceptRequest(
    @CurrentUser() currentUser: RequestUser,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.subscriptionsService.acceptRequest(currentUser.id, userId);

    // userId здесь — исходный отправитель заявки, теперь принятой.
    const { id: notificationId, actor } =
      await this.notificationsService.notifySubscriptionAccepted(userId, currentUser.id);
    this.realtimeGateway.emitToUser(userId, 'subscription-request:accepted', {
      notificationId,
      actor,
    });
  }

  @Delete('requests/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async respondToRequest(
    @CurrentUser() currentUser: RequestUser,
    @Param('userId') userId: string,
  ): Promise<void> {
    const { removed } = await this.subscriptionsService.respondToRequest(currentUser.id, userId);

    if (removed) {
      this.realtimeGateway.emitToUser(userId, 'subscription-request:removed', {
        userId: currentUser.id,
      });
    }
  }
}
