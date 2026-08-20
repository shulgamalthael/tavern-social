import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import type { CommunityDto } from './communities.types';
import { CommunitiesService } from './communities.service';

@Controller('communities')
@UseGuards(SessionAuthGuard)
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Get()
  async list(@CurrentUser() currentUser: RequestUser): Promise<CommunityDto[]> {
    return this.communitiesService.list(currentUser.id);
  }

  @Post(':id/membership')
  async join(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') communityId: string,
  ): Promise<CommunityDto> {
    return this.communitiesService.join(communityId, currentUser.id);
  }

  @Delete(':id/membership')
  async leave(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') communityId: string,
  ): Promise<CommunityDto> {
    return this.communitiesService.leave(communityId, currentUser.id);
  }
}
