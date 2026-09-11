import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { StoriesService } from './stories.service';
import type { StoryDto, StoryGroupDto, StoryViewerEntryDto } from './stories.types';

@Controller('stories')
@UseGuards(SessionAuthGuard)
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get('tray')
  async getTray(@CurrentUser() currentUser: RequestUser): Promise<StoryGroupDto[]> {
    return this.storiesService.getTray(currentUser.id);
  }

  @Get('user/:userId')
  async getForUser(
    @CurrentUser() currentUser: RequestUser,
    @Param('userId') userId: string,
  ): Promise<StoryGroupDto> {
    return this.storiesService.getForUser(userId, currentUser.id);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', createImageMulterOptions('stories')))
  async create(
    @CurrentUser() currentUser: RequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<StoryDto> {
    assertUploadedFile(file);
    return this.storiesService.create(currentUser.id, uploadedFileUrl('stories', file.filename));
  }

  @Post(':id/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markViewed(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.storiesService.markViewed(id, currentUser.id);
  }

  @Get(':id/viewers')
  async getViewers(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
  ): Promise<StoryViewerEntryDto[]> {
    return this.storiesService.getViewers(id, currentUser.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() currentUser: RequestUser, @Param('id') id: string): Promise<void> {
    await this.storiesService.remove(id, currentUser.id);
  }
}
