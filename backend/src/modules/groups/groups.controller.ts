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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import { assertUploadedFile, createImageMulterOptions, uploadedFileUrl } from '@/common/lib/upload';
import type { RequestUser } from '@/common/types/authenticated-request';
import type { PaginatedDto } from '@/common/types/paginated';
import { RealtimeGateway } from '@/infrastructure/websocket/realtime.gateway';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import type { PostDto } from '@/modules/posts/posts.types';
import { PostsService } from '@/modules/posts/posts.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import type { GroupDto, GroupJoinRequestDto, GroupMemberDto } from './groups.types';
import { GroupsService } from './groups.service';

@Controller('groups')
@UseGuards(SessionAuthGuard)
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly postsService: PostsService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  @Get()
  async list(
    @CurrentUser() currentUser: RequestUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedDto<GroupDto>> {
    return this.groupsService.list(currentUser.id, query.cursor, query.limit);
  }

  @Post()
  async create(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: CreateGroupDto,
  ): Promise<GroupDto> {
    return this.groupsService.create(currentUser.id, dto);
  }

  @Get(':id')
  async getOne(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') groupId: string,
  ): Promise<GroupDto> {
    return this.groupsService.getOne(groupId, currentUser.id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') groupId: string,
    @Body() dto: UpdateGroupDto,
  ): Promise<GroupDto> {
    return this.groupsService.update(groupId, currentUser.id, dto);
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file', createImageMulterOptions('groups')))
  async uploadAvatar(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') groupId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<GroupDto> {
    assertUploadedFile(file);
    return this.groupsService.setAvatar(
      groupId,
      currentUser.id,
      uploadedFileUrl('groups', file.filename),
    );
  }

  @Post(':id/cover')
  @UseInterceptors(FileInterceptor('file', createImageMulterOptions('groups')))
  async uploadCover(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') groupId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<GroupDto> {
    assertUploadedFile(file);
    return this.groupsService.setCover(
      groupId,
      currentUser.id,
      uploadedFileUrl('groups', file.filename),
    );
  }

  @Post(':id/membership')
  async join(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') groupId: string,
  ): Promise<GroupDto> {
    return this.groupsService.join(groupId, currentUser.id);
  }

  @Delete(':id/membership')
  async leave(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') groupId: string,
  ): Promise<GroupDto> {
    return this.groupsService.leave(groupId, currentUser.id);
  }

  @Post(':id/join-requests')
  async requestJoin(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') groupId: string,
  ): Promise<GroupDto> {
    const { group, ownerId, created } = await this.groupsService.requestJoin(
      groupId,
      currentUser.id,
    );

    if (created) {
      const { id: notificationId, actor } = await this.notificationsService.notifyGroupJoinRequest(
        ownerId,
        currentUser.id,
        groupId,
      );
      this.realtimeGateway.emitToUser(ownerId, 'group-join-request:new', {
        notificationId,
        actor,
        group: { id: group.id, name: group.name },
      });
    }

    return group;
  }

  @Get(':id/join-requests')
  async listJoinRequests(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') groupId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedDto<GroupJoinRequestDto>> {
    return this.groupsService.listJoinRequests(groupId, currentUser.id, query.cursor, query.limit);
  }

  @Post(':id/join-requests/:userId/approve')
  async approveJoinRequest(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') groupId: string,
    @Param('userId') userId: string,
  ): Promise<GroupDto> {
    await this.groupsService.approveJoinRequest(groupId, currentUser.id, userId);

    const group = await this.groupsService.getOne(groupId, currentUser.id);
    const { id: notificationId, actor } = await this.notificationsService.notifyGroupJoinAccepted(
      userId,
      currentUser.id,
      groupId,
    );
    this.realtimeGateway.emitToUser(userId, 'group-join-request:accepted', {
      notificationId,
      actor,
      group: { id: group.id, name: group.name },
    });

    return group;
  }

  @Delete(':id/join-requests/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async rejectJoinRequest(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') groupId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.groupsService.rejectJoinRequest(groupId, currentUser.id, userId);
  }

  @Get(':id/members')
  async listMembers(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') groupId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedDto<GroupMemberDto>> {
    return this.groupsService.listMembers(groupId, currentUser.id, query.cursor, query.limit);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') groupId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.groupsService.removeMember(groupId, currentUser.id, userId);
  }

  @Get(':id/posts')
  async listPosts(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') groupId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedDto<PostDto>> {
    return this.postsService.listGroupPosts(groupId, currentUser.id, query.cursor, query.limit);
  }
}
