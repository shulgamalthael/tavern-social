import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import type { PaginatedDto } from '@/common/types/paginated';
import type { CommunityDto } from './communities.types';
import { CommunitiesService } from './communities.service';

@Controller('communities')
@UseGuards(SessionAuthGuard)
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Get()
  async list(
    @CurrentUser() currentUser: RequestUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedDto<CommunityDto>> {
    return this.communitiesService.list(currentUser.id, query.cursor, query.limit);
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
