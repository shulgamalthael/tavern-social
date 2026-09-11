import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '@/common/guards/admin.guard';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import { CreatorCategoriesService } from './creator-categories.service';
import { CreatorsService } from './creators.service';
import type { AdminCreatorCategoryDto, AdminCreatorListItemDto } from './creators.types';
import { CreateCreatorCategoryDto } from './dto/create-creator-category.dto';
import { ListAdminCreatorsDto } from './dto/list-admin-creators.dto';
import { SuspendCreatorDto } from './dto/moderate-creator.dto';
import { UpdateCreatorCategoryDto } from './dto/update-creator-category.dto';

/**
 * Admin Creators (AI_PLATFORM_ROADMAP.md §79) — заметно уже, чем
 * `AdminAdvertisingController`: верификация личности проходит автоматически
 * через Stripe Identity (вебхук, см. `StripeIdentityWebhookController`), так
 * что здесь нет очереди "approve/reject документ" — только список по
 * статусу и suspend/reinstate за нарушения политики, не связанные с
 * личностью (тот же shape, что `AdCampaignsService.approve`/`reject`).
 *
 * `categories/*` (§84) — CRUD над `CreatorCategory`, изначально отложенный
 * nice-to-have (§79): `categories` — литеральный сегмент пути, не
 * пересекается с `:id/suspend`/`:id/reinstate` выше (Nest матчит по
 * количеству и буквальности сегментов, а не только по порядку регистрации).
 */
@Controller('admin/creators')
@UseGuards(SessionAuthGuard, AdminGuard)
export class AdminCreatorsController {
  constructor(
    private readonly creatorsService: CreatorsService,
    private readonly categoriesService: CreatorCategoriesService,
  ) {}

  @Get()
  list(@Query() query: ListAdminCreatorsDto): Promise<AdminCreatorListItemDto[]> {
    return this.creatorsService.adminList(query.status);
  }

  @Post(':id/suspend')
  suspend(@Param('id') id: string, @Body() dto: SuspendCreatorDto): Promise<void> {
    return this.creatorsService.adminSuspend(id, dto.reason);
  }

  @Post(':id/reinstate')
  reinstate(@Param('id') id: string): Promise<void> {
    return this.creatorsService.adminReinstate(id);
  }

  @Get('categories')
  listCategories(): Promise<AdminCreatorCategoryDto[]> {
    return this.categoriesService.listFlatForAdmin();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCreatorCategoryDto): Promise<AdminCreatorCategoryDto> {
    return this.categoriesService.create(dto);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCreatorCategoryDto,
  ): Promise<AdminCreatorCategoryDto> {
    return this.categoriesService.update(id, dto);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string): Promise<void> {
    return this.categoriesService.remove(id);
  }
}
