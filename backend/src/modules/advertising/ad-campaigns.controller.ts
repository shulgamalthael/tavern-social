import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
  createVideoMulterOptions,
  deleteUploadedFile,
  uploadedFileUrl,
} from '@/common/lib/upload';
import type { RequestUser } from '@/common/types/authenticated-request';
import { MediaAssetsService } from '@/modules/media-assets/media-assets.service';
import { AdvertisingInventoryService } from './advertising-inventory.service';
import { AddAdCreativeDto } from './dto/add-ad-creative.dto';
import { CreateAdCampaignDto } from './dto/create-ad-campaign.dto';
import { TopUpAdCampaignDto } from './dto/top-up-ad-campaign.dto';
import type { AdCampaignDto, AdInventoryDto, PlacementInsightDto } from './advertising.types';
import { AdCampaignsService } from './ad-campaigns.service';

/** Владелец-only — тот же принцип разделения владелец/публика, что у
 * `OrdersController`/`PublicSitesController`: анонимная доставка креатива
 * посетителю живёт отдельно, в `PublicSitesController` (`GET .../ads/
 * select`, `POST .../ads/impression|click`), см. корневой план фичи §4. */
@Controller('businesses/:businessId/advertising')
@UseGuards(SessionAuthGuard)
export class AdCampaignsController {
  constructor(
    private readonly adCampaignsService: AdCampaignsService,
    private readonly inventoryService: AdvertisingInventoryService,
    private readonly mediaAssetsService: MediaAssetsService,
  ) {}

  @Get('inventory')
  getInventory(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<AdInventoryDto> {
    return this.inventoryService.getInventoryForOwner(businessId, currentUser.id);
  }

  /** Подсказка для формы создания кампании — «популярные»/«свободные» места
   * по количеству уже активных кампаний, см. `AdCampaignsService.
   * getPlacementInsights`'s комментарий. */
  @Get('placement-insights')
  getPlacementInsights(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<PlacementInsightDto[]> {
    return this.adCampaignsService.getPlacementInsights(businessId, currentUser.id);
  }

  @Get('campaigns')
  list(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<AdCampaignDto[]> {
    return this.adCampaignsService.list(businessId, currentUser.id);
  }

  @Get('campaigns/:campaignId')
  get(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
  ): Promise<AdCampaignDto> {
    return this.adCampaignsService.get(businessId, campaignId, currentUser.id);
  }

  @Post('campaigns')
  create(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateAdCampaignDto,
  ): Promise<AdCampaignDto> {
    return this.adCampaignsService.create(businessId, currentUser.id, dto);
  }

  @Post('campaigns/:campaignId/creatives')
  addCreative(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: AddAdCreativeDto,
  ): Promise<AdCampaignDto> {
    return this.adCampaignsService.addCreative(businessId, campaignId, currentUser.id, dto);
  }

  @Delete('campaigns/:campaignId/creatives/:creativeId')
  removeCreative(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
    @Param('creativeId') creativeId: string,
  ): Promise<AdCampaignDto> {
    return this.adCampaignsService.removeCreative(
      businessId,
      campaignId,
      creativeId,
      currentUser.id,
    );
  }

  @Post('campaigns/:campaignId/submit')
  submitForReview(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
  ): Promise<AdCampaignDto> {
    return this.adCampaignsService.submitForReview(businessId, campaignId, currentUser.id);
  }

  /** Доплата бюджета к `paused`-кампании — см. `AdCampaignsService.
   * requestTopUp`'s комментарий. Тот же ответ-с-`clientSecret` приём, что и
   * `submitForReview` — фронтенд открывает тот же `StripePaymentForm`. */
  @Post('campaigns/:campaignId/topup')
  requestTopUp(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: TopUpAdCampaignDto,
  ): Promise<AdCampaignDto> {
    return this.adCampaignsService.requestTopUp(businessId, campaignId, currentUser.id, dto);
  }

  /** См. `ProductsController.uploadImage` — тот же приём: файл валиден
   * физически (multer уже сохранил его на диск), но `imageUrl`/`videoUrl`
   * креатива примутся только когда владение подтверждено ЗДЕСЬ и результат
   * уже лежит в библиотеке медиа бизнеса (`AdCampaignsService.addCreative`
   * повторно проверяет это по `MediaAssetsService.list`, не доверяя одному
   * этому эндпоинту). */
  @Post('creatives/images')
  @UseInterceptors(FileInterceptor('file', createImageMulterOptions('ads')))
  async uploadImage(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ url: string }> {
    assertUploadedFile(file);
    const url = uploadedFileUrl('ads', file.filename);
    try {
      await this.adCampaignsService.assertOwnership(businessId, currentUser.id);
    } catch (error) {
      deleteUploadedFile(url);
      throw error;
    }
    await this.mediaAssetsService.record(businessId, url, file.mimetype);
    return { url };
  }

  /** Точное зеркало `uploadImage` выше — единственная разница: multer-конфиг
   * (`createVideoMulterOptions`, MP4/WebM, `MAX_VIDEO_BYTES`) и целевой формат
   * креатива (`AdFormat.video`, см. `AddAdCreativeDto`/`AdCampaignsService.
   * addCreative`'s проверку "format video требует videoUrl"). */
  @Post('creatives/videos')
  @UseInterceptors(FileInterceptor('file', createVideoMulterOptions('ads')))
  async uploadVideo(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ url: string }> {
    assertUploadedFile(file);
    const url = uploadedFileUrl('ads', file.filename);
    try {
      await this.adCampaignsService.assertOwnership(businessId, currentUser.id);
    } catch (error) {
      deleteUploadedFile(url);
      throw error;
    }
    await this.mediaAssetsService.record(businessId, url, file.mimetype);
    return { url };
  }
}
