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
import {
  assertUploadedFile,
  createImageMulterOptions,
  deleteUploadedFile,
  uploadedFileUrl,
} from '@/common/lib/upload';
import type { RequestUser } from '@/common/types/authenticated-request';
import { MediaAssetsService } from '@/modules/media-assets/media-assets.service';
import { UpdateWebsiteDocumentDto } from './dto/update-website-document.dto';
import type { WebsiteDraftDto, WebsitePublicDto } from './websites.types';
import { WebsitesService } from './websites.service';

/** Вложено под `/businesses/:businessId/website`, не отдельный ресурс
 * верхнего уровня — сайт не существует без бизнеса (ровно один на бизнес,
 * см. схему), тот же принцип вложенности, что у `/groups/:id/members`. */
@Controller('businesses/:businessId/website')
@UseGuards(SessionAuthGuard)
export class WebsitesController {
  constructor(
    private readonly websitesService: WebsitesService,
    private readonly mediaAssetsService: MediaAssetsService,
  ) {}

  @Get()
  getDraft(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<WebsiteDraftDto> {
    return this.websitesService.getDraft(businessId, currentUser.id);
  }

  @Patch()
  saveDraft(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Body() dto: UpdateWebsiteDocumentDto,
  ): Promise<WebsiteDraftDto> {
    return this.websitesService.saveDraft(businessId, currentUser.id, dto);
  }

  @Post('publish')
  publish(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<WebsiteDraftDto> {
    return this.websitesService.publish(businessId, currentUser.id);
  }

  /** Без владения — см. `WebsitesService.getPublic`. Отдельный путь, не
   * просто «GET без проверки», чтобы случайно не ослабить основной `GET`
   * черновика (он должен оставаться owner-only всегда). */
  @Get('public')
  getPublic(@Param('businessId') businessId: string): Promise<WebsitePublicDto> {
    return this.websitesService.getPublic(businessId);
  }

  /** Загрузка картинки для содержимого блока (фон Hero, галерея, фото
   * команды…) — возвращает URL, ссылку на него кладёт в `props` нужного
   * блока сам builder (frontend); отдельной таблицы «картинок сайта» на
   * этот случай нет (тот же осознанный компромисс, что и у `remove` в
   * `BusinessesService` — см. её комментарий про garbage collection), но
   * URL всё равно попадает в общую медиатеку бизнеса (см. `MediaAssets
   * Service.record`, комментарий модели `MediaAsset`) — чтобы это же фото
   * можно было выбрать повторно на другом блоке, не загружая файл заново. */
  @Post('assets')
  @UseInterceptors(FileInterceptor('file', createImageMulterOptions('website')))
  async uploadAsset(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ url: string }> {
    assertUploadedFile(file);
    const url = uploadedFileUrl('website', file.filename);
    try {
      // Multer уже записал файл на диск (интерцептор отрабатывает раньше
      // тела метода) — если бизнес не найден/чужой, подчищаем его, а не
      // оставляем висеть ничьей ссылкой.
      await this.websitesService.assertOwnership(businessId, currentUser.id);
    } catch (error) {
      deleteUploadedFile(url);
      throw error;
    }
    await this.mediaAssetsService.record(businessId, url, file.mimetype);
    return { url };
  }
}
