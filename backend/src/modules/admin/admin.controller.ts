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
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AdminGuard } from '@/common/guards/admin.guard';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import type { PaginatedDto } from '@/common/types/paginated';
import { AdminService } from './admin.service';
import type {
  AdminCommunityDto,
  AdminGroupDto,
  AdminPostDto,
  AdminStatsDto,
  AdminUserDto,
} from './admin.types';
import { BanUserDto } from './dto/ban-user.dto';
import { ListAdminCommunitiesDto } from './dto/list-admin-communities.dto';
import { ListAdminGroupsDto } from './dto/list-admin-groups.dto';
import { ListAdminPostsDto } from './dto/list-admin-posts.dto';
import { ListAdminUsersDto } from './dto/list-admin-users.dto';
import { SetUserRoleDto } from './dto/set-user-role.dto';

/** Каждый маршрут — `SessionAuthGuard` (кто это) + `AdminGuard` (админ ли
 * это), в этом порядке: `AdminGuard` читает `request.user.role`, который
 * кладёт именно `SessionAuthGuard`. */
@Controller('admin')
@UseGuards(SessionAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats(): Promise<AdminStatsDto> {
    return this.adminService.getStats();
  }

  @Get('users')
  listUsers(@Query() query: ListAdminUsersDto): Promise<PaginatedDto<AdminUserDto>> {
    return this.adminService.listUsers(query);
  }

  @Post('users/:id/ban')
  banUser(
    @Param('id') id: string,
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: BanUserDto,
  ): Promise<AdminUserDto> {
    return this.adminService.banUser(id, currentUser.id, dto);
  }

  @Post('users/:id/unban')
  unbanUser(@Param('id') id: string): Promise<AdminUserDto> {
    return this.adminService.unbanUser(id);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(@Param('id') id: string, @CurrentUser() currentUser: RequestUser): Promise<void> {
    return this.adminService.deleteUser(id, currentUser.id);
  }

  @Patch('users/:id/role')
  setUserRole(
    @Param('id') id: string,
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: SetUserRoleDto,
  ): Promise<AdminUserDto> {
    return this.adminService.setUserRole(id, currentUser.id, dto);
  }

  @Get('posts')
  listPosts(@Query() query: ListAdminPostsDto): Promise<PaginatedDto<AdminPostDto>> {
    return this.adminService.listPosts(query);
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePost(@Param('id') id: string): Promise<void> {
    return this.adminService.deletePost(id);
  }

  @Get('groups')
  listGroups(@Query() query: ListAdminGroupsDto): Promise<PaginatedDto<AdminGroupDto>> {
    return this.adminService.listGroups(query);
  }

  @Delete('groups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteGroup(@Param('id') id: string): Promise<void> {
    return this.adminService.deleteGroup(id);
  }

  @Get('communities')
  listCommunities(
    @Query() query: ListAdminCommunitiesDto,
  ): Promise<PaginatedDto<AdminCommunityDto>> {
    return this.adminService.listCommunities(query);
  }

  @Delete('communities/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCommunity(@Param('id') id: string): Promise<void> {
    return this.adminService.deleteCommunity(id);
  }
}
