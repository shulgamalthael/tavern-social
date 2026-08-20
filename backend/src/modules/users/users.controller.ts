import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { FriendsService } from '@/modules/friends/friends.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import type { MeProfile, UserProfileDto } from './users.types';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(SessionAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly friendsService: FriendsService,
  ) {}

  @Get('me')
  async me(@CurrentUser() currentUser: RequestUser): Promise<MeProfile> {
    const user = await this.usersService.findByIdOrThrow(currentUser.id);
    return this.usersService.toMeProfile(user);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<MeProfile> {
    const user = await this.usersService.updateProfile(currentUser.id, dto);
    return this.usersService.toMeProfile(user);
  }

  @Patch('me/settings')
  async updateSettings(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: UpdateSettingsDto,
  ): Promise<MeProfile> {
    const user = await this.usersService.updateSettings(currentUser.id, dto);
    return this.usersService.toMeProfile(user);
  }

  // Должен идти после статичных маршрутов `me`/`me/settings` — Nest
  // сопоставляет маршруты в порядке объявления, и `:id` иначе перехватил бы их.
  @Get(':id')
  async getById(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
  ): Promise<UserProfileDto> {
    const user = await this.usersService.findByIdOrThrow(id);
    const friendship = await this.friendsService.getStatus(currentUser.id, id);
    return { ...this.usersService.toPublicProfile(user), friendship };
  }
}
