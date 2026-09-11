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
import { AddNativeAdCreativeDto } from './dto/add-native-ad-creative.dto';
import { CreateNativeAdCampaignDto } from './dto/create-native-ad-campaign.dto';
import { NativeAdCampaignsService } from './native-ad-campaigns.service';
import { NativeAdRevenueService } from './native-ad-revenue.service';
import type { NativeAdCampaignDto, NativeAdCampaignRevenueBreakdownDto } from './native-ads.types';

/** Владелец-only self-service — точное зеркало `AdCampaignsController`
 * (`advertising` module), см. `NativeAdCampaignsService`'s комментарий. */
@Controller('businesses/:businessId/native-ad-campaigns')
@UseGuards(SessionAuthGuard)
export class NativeAdCampaignsController {
  constructor(
    private readonly campaignsService: NativeAdCampaignsService,
    private readonly mediaAssetsService: MediaAssetsService,
    private readonly revenueService: NativeAdRevenueService,
  ) {}

  @Get()
  list(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<NativeAdCampaignDto[]> {
    return this.campaignsService.list(businessId, currentUser.id);
  }

  @Get(':campaignId')
  get(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
  ): Promise<NativeAdCampaignDto> {
    return this.campaignsService.get(businessId, campaignId, currentUser.id);
  }

  /** Рекламодатель-facing прозрачность (Phase 4) — см.
   * `NativeAdRevenueService.getCampaignBreakdown`'s комментарий. */
  @Get(':campaignId/revenue-breakdown')
  getRevenueBreakdown(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
  ): Promise<NativeAdCampaignRevenueBreakdownDto> {
    return this.revenueService.getCampaignBreakdown(businessId, campaignId, currentUser.id);
  }

  @Post()
  create(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateNativeAdCampaignDto,
  ): Promise<NativeAdCampaignDto> {
    return this.campaignsService.create(businessId, currentUser.id, dto);
  }

  @Post(':campaignId/creatives')
  addCreative(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: AddNativeAdCreativeDto,
  ): Promise<NativeAdCampaignDto> {
    return this.campaignsService.addCreative(businessId, campaignId, currentUser.id, dto);
  }

  @Delete(':campaignId/creatives/:creativeId')
  removeCreative(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
    @Param('creativeId') creativeId: string,
  ): Promise<NativeAdCampaignDto> {
    return this.campaignsService.removeCreative(businessId, campaignId, creativeId, currentUser.id);
  }

  @Post(':campaignId/submit')
  submitForReview(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
  ): Promise<NativeAdCampaignDto> {
    return this.campaignsService.submitForReview(businessId, campaignId, currentUser.id);
  }

  /** Точное зеркало `AdCampaignsController.uploadImage` — тот же upload
   * subdir `ads` (тот же движок, что и сайтовая реклама, никакого нового
   * multer-конфига не заводим). */
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
      await this.campaignsService.assertOwnership(businessId, currentUser.id);
    } catch (error) {
      deleteUploadedFile(url);
      throw error;
    }
    await this.mediaAssetsService.record(businessId, url, file.mimetype);
    return { url };
  }

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
      await this.campaignsService.assertOwnership(businessId, currentUser.id);
    } catch (error) {
      deleteUploadedFile(url);
      throw error;
    }
    await this.mediaAssetsService.record(businessId, url, file.mimetype);
    return { url };
  }
}
