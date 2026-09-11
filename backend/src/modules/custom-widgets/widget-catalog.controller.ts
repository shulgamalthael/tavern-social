import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { RecordCatalogInsertDto } from './dto/record-catalog-insert.dto';
import type { CatalogWidgetDto } from './custom-widgets.types';
import { CustomWidgetsService } from './custom-widgets.service';

/**
 * Общий каталог виджетов (AI_PLATFORM_ROADMAP.md §74) — сознательно НЕ
 * вложен под `/businesses/:businessId/...`, как owner-scoped
 * `CustomWidgetsController`: список один и тот же для всех бизнесов, здесь
 * нет "своего" businessId в URL. `SessionAuthGuard` всё равно требует
 * реальной сессии (не полностью анонимный эндпоинт, в отличие от публичных
 * `PublicSitesController`-путей) — виджеты не предназначены посетителям
 * сайтов, только владельцам бизнесов в билдере.
 */
@Controller('widget-catalog')
@UseGuards(SessionAuthGuard)
export class WidgetCatalogController {
  constructor(private readonly customWidgetsService: CustomWidgetsService) {}

  @Get()
  list(): Promise<CatalogWidgetDto[]> {
    return this.customWidgetsService.listCatalog();
  }

  /** Вызывается fire-and-forget с frontend при ручной вставке каталожного
   * виджета (`ComponentLibraryPanel`'s секция «Каталог виджетов») — тот же
   * счётчик, что инкрементирует и `InsertCustomWidgetTool` (AI-путь), см.
   * `CustomWidgetsService.recordCatalogInsert`. */
  @Post(':widgetId/record-insert')
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordInsert(
    @CurrentUser() currentUser: RequestUser,
    @Param('widgetId') widgetId: string,
    @Body() dto: RecordCatalogInsertDto,
  ): Promise<void> {
    await this.customWidgetsService.assertOwnership(dto.businessId, currentUser.id);
    await this.customWidgetsService.recordCatalogInsert(widgetId, dto.businessId);
  }
}
