import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import { assertUploadedFile, createImageMulterOptions, uploadedFileUrl } from '@/common/lib/upload';
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

  // Оба маршрута — только `me`, без `:id` — владение структурно гарантировано
  // самим маршрутом, как и у PATCH /users/me выше.
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', createImageMulterOptions('avatars')))
  async uploadAvatar(
    @CurrentUser() currentUser: RequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MeProfile> {
    assertUploadedFile(file);
    const user = await this.usersService.setAvatar(
      currentUser.id,
      uploadedFileUrl('avatars', file.filename),
    );
    return this.usersService.toMeProfile(user);
  }

  @Post('me/cover')
  @UseInterceptors(FileInterceptor('file', createImageMulterOptions('covers')))
  async uploadCover(
    @CurrentUser() currentUser: RequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MeProfile> {
    assertUploadedFile(file);
    const user = await this.usersService.setCover(
      currentUser.id,
      uploadedFileUrl('covers', file.filename),
    );
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
