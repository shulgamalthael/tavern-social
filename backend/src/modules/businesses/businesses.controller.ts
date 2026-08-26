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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import { assertUploadedFile, createImageMulterOptions, uploadedFileUrl } from '@/common/lib/upload';
import type { RequestUser } from '@/common/types/authenticated-request';
import type { BusinessDto } from './businesses.types';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Controller('businesses')
@UseGuards(SessionAuthGuard)
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  list(@CurrentUser() currentUser: RequestUser): Promise<BusinessDto[]> {
    return this.businessesService.list(currentUser.id);
  }

  @Post()
  create(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: CreateBusinessDto,
  ): Promise<BusinessDto> {
    return this.businessesService.create(currentUser.id, dto);
  }

  @Get(':id')
  getOne(@CurrentUser() currentUser: RequestUser, @Param('id') id: string): Promise<BusinessDto> {
    return this.businessesService.getOne(id, currentUser.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateBusinessDto,
  ): Promise<BusinessDto> {
    return this.businessesService.update(id, currentUser.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() currentUser: RequestUser, @Param('id') id: string): Promise<void> {
    return this.businessesService.remove(id, currentUser.id);
  }

  @Post(':id/duplicate')
  duplicate(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
  ): Promise<BusinessDto> {
    return this.businessesService.duplicate(id, currentUser.id);
  }

  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file', createImageMulterOptions('businesses')))
  uploadLogo(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<BusinessDto> {
    assertUploadedFile(file);
    return this.businessesService.setLogo(
      id,
      currentUser.id,
      uploadedFileUrl('businesses', file.filename),
    );
  }

  @Post(':id/favicon')
  @UseInterceptors(FileInterceptor('file', createImageMulterOptions('businesses')))
  uploadFavicon(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<BusinessDto> {
    assertUploadedFile(file);
    return this.businessesService.setFavicon(
      id,
      currentUser.id,
      uploadedFileUrl('businesses', file.filename),
    );
  }
}
