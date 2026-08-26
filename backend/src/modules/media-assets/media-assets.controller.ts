import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import type { MediaAssetDto } from './media-assets.types';
import { MediaAssetsService } from './media-assets.service';

/** Владелец-only чтение — записи сюда попадают только как побочный эффект
 * других upload-эндпоинтов (см. `MediaAssetsService.record`), не через
 * этот контроллер: здесь нет `POST`. */
@Controller('businesses/:businessId/media')
@UseGuards(SessionAuthGuard)
export class MediaAssetsController {
  constructor(private readonly mediaAssetsService: MediaAssetsService) {}

  @Get()
  list(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<MediaAssetDto[]> {
    return this.mediaAssetsService.list(businessId, currentUser.id);
  }
}
