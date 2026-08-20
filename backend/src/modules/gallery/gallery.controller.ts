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
import { UsersService } from '@/modules/users/users.service';
import { GalleryService } from './gallery.service';
import type { GalleryImageDto } from './gallery.types';

@Controller('users')
@UseGuards(SessionAuthGuard)
export class GalleryController {
  constructor(
    private readonly galleryService: GalleryService,
    private readonly usersService: UsersService,
  ) {}

  // Просмотр галереи — любой залогиненный пользователь, как и GET /users/:id.
  @Get(':id/gallery')
  async list(@Param('id') userId: string): Promise<GalleryImageDto[]> {
    await this.usersService.findByIdOrThrow(userId);
    return this.galleryService.list(userId);
  }

  @Post('me/gallery')
  @UseInterceptors(FileInterceptor('file', createImageMulterOptions('gallery')))
  async upload(
    @CurrentUser() currentUser: RequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<GalleryImageDto> {
    assertUploadedFile(file);
    return this.galleryService.add(currentUser.id, uploadedFileUrl('gallery', file.filename));
  }

  @Delete('me/gallery/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() currentUser: RequestUser,
    @Param('imageId') imageId: string,
  ): Promise<void> {
    await this.galleryService.remove(currentUser.id, imageId);
  }
}
