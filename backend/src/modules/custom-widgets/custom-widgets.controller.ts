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
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { CreateCustomWidgetDto } from './dto/create-custom-widget.dto';
import { UpdateCustomWidgetDto } from './dto/update-custom-widget.dto';
import type { CustomWidgetDto } from './custom-widgets.types';
import { CustomWidgetsService } from './custom-widgets.service';

/** Вложено под `/businesses/:businessId/widgets` — тот же принцип, что у
 * `DiscountsController`/`RulesController`, целиком owner-only. Нет
 * публичного read-пути (в отличие от `DiscountsController`'s preview) —
 * виджет в этой версии нигде не рендерится на публичном сайте, см.
 * `CustomWidgetsService`'s комментарий. */
@Controller('businesses/:businessId/widgets')
@UseGuards(SessionAuthGuard)
export class CustomWidgetsController {
  constructor(private readonly customWidgetsService: CustomWidgetsService) {}

  @Get()
  list(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<CustomWidgetDto[]> {
    return this.customWidgetsService.list(businessId, currentUser.id);
  }

  @Post()
  create(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateCustomWidgetDto,
  ): Promise<CustomWidgetDto> {
    return this.customWidgetsService.create(businessId, currentUser.id, dto);
  }

  @Patch(':widgetId')
  update(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('widgetId') widgetId: string,
    @Body() dto: UpdateCustomWidgetDto,
  ): Promise<CustomWidgetDto> {
    return this.customWidgetsService.update(businessId, widgetId, currentUser.id, dto);
  }

  @Delete(':widgetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('widgetId') widgetId: string,
  ): Promise<void> {
    return this.customWidgetsService.remove(businessId, widgetId, currentUser.id);
  }
}
