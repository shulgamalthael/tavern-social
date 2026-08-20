import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import type { NotificationsListDto } from './notifications.types';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(SessionAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() currentUser: RequestUser,
    @Query() query: ListNotificationsDto,
  ): Promise<NotificationsListDto> {
    return this.notificationsService.list(currentUser.id, query.cursor, query.limit);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() currentUser: RequestUser): Promise<{ count: number }> {
    const count = await this.notificationsService.unreadCount(currentUser.id);
    return { count };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(@CurrentUser() currentUser: RequestUser, @Param('id') id: string): Promise<void> {
    await this.notificationsService.markRead(currentUser.id, id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead(@CurrentUser() currentUser: RequestUser): Promise<void> {
    await this.notificationsService.markAllRead(currentUser.id);
  }
}
