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
import { AddCustomEntityFieldDto } from './dto/add-custom-entity-field.dto';
import { CreateCustomEntityDto } from './dto/create-custom-entity.dto';
import { UpdateCustomEntityDto } from './dto/update-custom-entity.dto';
import { UpsertCustomEntityRecordDto } from './dto/upsert-custom-entity-record.dto';
import type { CustomEntityDto, CustomEntityRecordDto } from './custom-entities.types';
import { CustomEntitiesService } from './custom-entities.service';

/** Вложено под `/businesses/:businessId/custom-entities` — тот же принцип,
 * что у `RulesController`/`CustomWidgetsController`, целиком owner-only.
 * Записи (`/records`) — второй уровень вложенности под конкретной сущностью,
 * не отдельный контроллер (тот же одиночный-потребитель случай, что делает
 * `RulesController`'s `loyalty-accounts` веткой внутри него же, не новым
 * контроллером, см. `AGENTS.md` backend §2). */
@Controller('businesses/:businessId/custom-entities')
@UseGuards(SessionAuthGuard)
export class CustomEntitiesController {
  constructor(private readonly customEntitiesService: CustomEntitiesService) {}

  @Get()
  listEntities(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<CustomEntityDto[]> {
    return this.customEntitiesService.listEntities(businessId, currentUser.id);
  }

  @Post()
  createEntity(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateCustomEntityDto,
  ): Promise<CustomEntityDto> {
    return this.customEntitiesService.createEntity(businessId, currentUser.id, dto);
  }

  @Patch(':entityId')
  rename(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('entityId') entityId: string,
    @Body() dto: UpdateCustomEntityDto,
  ): Promise<CustomEntityDto> {
    return this.customEntitiesService.rename(businessId, entityId, currentUser.id, dto);
  }

  @Post(':entityId/fields')
  addField(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('entityId') entityId: string,
    @Body() dto: AddCustomEntityFieldDto,
  ): Promise<CustomEntityDto> {
    return this.customEntitiesService.addField(businessId, entityId, currentUser.id, dto);
  }

  @Delete(':entityId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEntity(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('entityId') entityId: string,
  ): Promise<void> {
    return this.customEntitiesService.removeEntity(businessId, entityId, currentUser.id);
  }

  @Get(':entityId/records')
  listRecords(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('entityId') entityId: string,
  ): Promise<CustomEntityRecordDto[]> {
    return this.customEntitiesService.listRecords(businessId, entityId, currentUser.id);
  }

  @Post(':entityId/records')
  createRecord(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('entityId') entityId: string,
    @Body() dto: UpsertCustomEntityRecordDto,
  ): Promise<CustomEntityRecordDto> {
    return this.customEntitiesService.createRecord(businessId, entityId, currentUser.id, dto);
  }

  @Patch(':entityId/records/:recordId')
  updateRecord(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('entityId') entityId: string,
    @Param('recordId') recordId: string,
    @Body() dto: UpsertCustomEntityRecordDto,
  ): Promise<CustomEntityRecordDto> {
    return this.customEntitiesService.updateRecord(
      businessId,
      entityId,
      recordId,
      currentUser.id,
      dto,
    );
  }

  @Delete(':entityId/records/:recordId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRecord(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('entityId') entityId: string,
    @Param('recordId') recordId: string,
  ): Promise<void> {
    return this.customEntitiesService.removeRecord(businessId, entityId, recordId, currentUser.id);
  }
}
