import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import type { GroupDto } from './groups.types';
import { GroupsService } from './groups.service';

@Controller('groups')
@UseGuards(SessionAuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  async list(@CurrentUser() currentUser: RequestUser): Promise<GroupDto[]> {
    return this.groupsService.listForUser(currentUser.id);
  }
}
