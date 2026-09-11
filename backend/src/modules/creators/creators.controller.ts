import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { CreatorCategoriesService } from './creator-categories.service';
import { CreatorsService } from './creators.service';
import type {
  CreatorCategoryNodeDto,
  CreatorEligibilityDto,
  CreatorIdentitySessionDto,
  CreatorProfileDto,
} from './creators.types';
import { StartCreatorOnboardingDto } from './dto/start-creator-onboarding.dto';
import { UpdateCreatorSettingsDto } from './dto/update-creator-settings.dto';

/**
 * Scoped к текущему пользователю (`req.user.id`), не к `businessId` — тот же
 * приём, что у `FriendsController`: Creator — свойство `User`, не `Business`
 * (AI_PLATFORM_ROADMAP.md §79).
 */
@Controller('creators')
@UseGuards(SessionAuthGuard)
export class CreatorsController {
  constructor(
    private readonly creatorsService: CreatorsService,
    private readonly categoriesService: CreatorCategoriesService,
  ) {}

  @Get('eligibility')
  getEligibility(@CurrentUser() currentUser: RequestUser): Promise<CreatorEligibilityDto> {
    return this.creatorsService.getEligibility(currentUser.id);
  }

  @Get('categories')
  getCategories(): Promise<CreatorCategoryNodeDto[]> {
    return this.categoriesService.listTree();
  }

  @Get('me')
  getMyProfile(@CurrentUser() currentUser: RequestUser): Promise<CreatorProfileDto | null> {
    return this.creatorsService.getMyProfile(currentUser.id);
  }

  @Post('onboarding')
  startOnboarding(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: StartCreatorOnboardingDto,
  ): Promise<CreatorProfileDto> {
    return this.creatorsService.startOnboarding(currentUser.id, dto);
  }

  @Patch('settings')
  updateSettings(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: UpdateCreatorSettingsDto,
  ): Promise<CreatorProfileDto> {
    return this.creatorsService.updateSettings(currentUser.id, dto);
  }

  @Post('identity-session')
  createIdentitySession(
    @CurrentUser() currentUser: RequestUser,
  ): Promise<CreatorIdentitySessionDto> {
    return this.creatorsService.createIdentitySession(currentUser.id);
  }

  /** Реальные выплаты через Stripe Connect (Phase 5) — см.
   * `CreatorsService.startStripeConnectOnboarding`'s комментарий. */
  @Post('stripe-connect/onboarding-link')
  startStripeConnectOnboarding(@CurrentUser() currentUser: RequestUser): Promise<{ url: string }> {
    return this.creatorsService.startStripeConnectOnboarding(currentUser.id);
  }

  @Post('stripe-connect/refresh-status')
  refreshStripeConnectStatus(@CurrentUser() currentUser: RequestUser): Promise<{ status: string }> {
    return this.creatorsService.refreshStripeConnectStatus(currentUser.id);
  }
}
