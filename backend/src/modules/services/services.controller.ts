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
import {
  assertUploadedFile,
  createImageMulterOptions,
  deleteUploadedFile,
  uploadedFileUrl,
} from '@/common/lib/upload';
import type { RequestUser } from '@/common/types/authenticated-request';
import { MediaAssetsService } from '@/modules/media-assets/media-assets.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import type { ServiceDto } from './services.types';
import { ServicesService } from './services.service';

/** Владелец-only — см. `ProductsController`, тот же принцип вложенности и
 * то же разделение с публичным чтением (`PublicSitesController.
 * getPublicServices`). */
@Controller('businesses/:businessId/services')
@UseGuards(SessionAuthGuard)
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly mediaAssetsService: MediaAssetsService,
  ) {}

  @Get()
  list(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<ServiceDto[]> {
    return this.servicesService.list(businessId, currentUser.id);
  }

  @Post()
  create(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateServiceDto,
  ): Promise<ServiceDto> {
    return this.servicesService.create(businessId, currentUser.id, dto);
  }

  @Patch(':serviceId')
  update(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('serviceId') serviceId: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<ServiceDto> {
    return this.servicesService.update(businessId, serviceId, currentUser.id, dto);
  }

  @Delete(':serviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('serviceId') serviceId: string,
  ): Promise<void> {
    return this.servicesService.remove(businessId, serviceId, currentUser.id);
  }

  /** См. `ProductsController.uploadImage` — тот же приём. */
  @Post('images')
  @UseInterceptors(FileInterceptor('file', createImageMulterOptions('services')))
  async uploadImage(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ url: string }> {
    assertUploadedFile(file);
    const url = uploadedFileUrl('services', file.filename);
    try {
      await this.servicesService.assertOwnership(businessId, currentUser.id);
    } catch (error) {
      deleteUploadedFile(url);
      throw error;
    }
    await this.mediaAssetsService.record(businessId, url, file.mimetype);
    return { url };
  }
}
