import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CustomEntity, CustomEntityRecord } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { AddCustomEntityFieldDto } from './dto/add-custom-entity-field.dto';
import type { CreateCustomEntityDto } from './dto/create-custom-entity.dto';
import type { SetCustomEntityVisibilityDto } from './dto/set-custom-entity-visibility.dto';
import type { UpdateCustomEntityDto } from './dto/update-custom-entity.dto';
import type { UpsertCustomEntityRecordDto } from './dto/upsert-custom-entity-record.dto';
import {
  appendField,
  parseEntityFields,
  validateRecordData,
  type CustomEntityField,
  type CustomEntityRecordValue,
} from './lib/custom-entity-schema.lib';
import type {
  CustomEntityDto,
  CustomEntityRecordDto,
  PublicCustomEntityDto,
} from './custom-entities.types';

/**
 * AI-8 первый ограниченный слайс (AI_PLATFORM_ROADMAP.md §2.2/§19) —
 * owner-CRUD для сущностей и их записей, тот же паттерн, что
 * `CustomWidgetsService`/`RulesService`. Два уровня owned-вложенности
 * (сущность внутри бизнеса, запись внутри сущности) — `findOwnedEntity`
 * проверяет оба первых уровня разом (бизнес + принадлежность сущности этому
 * бизнесу), `findOwnedRecord` берёт уже проверенный `entityId` как границу.
 *
 * `fields` можно только добавлять (`addField`) — `update`/`rename` НИКОГДА
 * не принимает `fields` целиком, чтобы владелец не мог случайно уронить
 * поле, от которого уже зависят существующие записи (см. `UpdateCustomEntityDto`'s
 * комментарий). Удаление всей сущности (`remove`) — по-прежнему возможно
 * (каскадно чистит записи), это осознанный, явный акт владельца, не то же
 * самое, что случайно потерять одно поле при правке.
 */
@Injectable()
export class CustomEntitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listEntities(businessId: string, ownerId: string): Promise<CustomEntityDto[]> {
    await this.assertOwnership(businessId, ownerId);
    const entities = await this.prisma.customEntity.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
    return entities.map((entity) => this.toEntityDto(entity));
  }

  async createEntity(
    businessId: string,
    ownerId: string,
    dto: CreateCustomEntityDto,
  ): Promise<CustomEntityDto> {
    await this.assertOwnership(businessId, ownerId);
    const fields = this.parseOrBadRequest(() => parseEntityFields(dto.fields));

    const entity = await this.prisma.customEntity.create({
      data: { businessId, name: dto.name, fields: fields as never },
    });
    return this.toEntityDto(entity);
  }

  async rename(
    businessId: string,
    entityId: string,
    ownerId: string,
    dto: UpdateCustomEntityDto,
  ): Promise<CustomEntityDto> {
    await this.findOwnedEntity(businessId, entityId, ownerId);
    const entity = await this.prisma.customEntity.update({
      where: { id: entityId },
      data: { name: dto.name },
    });
    return this.toEntityDto(entity);
  }

  async addField(
    businessId: string,
    entityId: string,
    ownerId: string,
    dto: AddCustomEntityFieldDto,
  ): Promise<CustomEntityDto> {
    const existing = await this.findOwnedEntity(businessId, entityId, ownerId);
    const fields = this.parseOrBadRequest(() =>
      appendField(existing.fields as unknown as CustomEntityField[], dto.field),
    );

    const entity = await this.prisma.customEntity.update({
      where: { id: entityId },
      data: { fields: fields as never },
    });
    return this.toEntityDto(entity);
  }

  async removeEntity(businessId: string, entityId: string, ownerId: string): Promise<void> {
    await this.findOwnedEntity(businessId, entityId, ownerId);
    await this.prisma.customEntity.delete({ where: { id: entityId } });
  }

  /** Единственное место, которое переключает `CustomEntity.isPublic` — см.
   * её комментарий в schema.prisma и `SetCustomEntityVisibilityDto`'s
   * комментарий про то, почему это отдельный узкий эндпоинт, не поле в
   * `UpdateCustomEntityDto`. Owner-only, как и всё остальное в этом
   * сервисе — переключить публичность своей же сущности может только сам
   * владелец бизнеса, никогда AI-инструмент (в `modules/ai/tools` для этого
   * сознательно нет тула — публикация потенциально приватных данных не
   * должна быть автоматизируемым действием). */
  async setVisibility(
    businessId: string,
    entityId: string,
    ownerId: string,
    dto: SetCustomEntityVisibilityDto,
  ): Promise<CustomEntityDto> {
    await this.findOwnedEntity(businessId, entityId, ownerId);
    const entity = await this.prisma.customEntity.update({
      where: { id: entityId },
      data: { isPublic: dto.isPublic },
    });
    return this.toEntityDto(entity);
  }

  /** По-настоящему анонимно — см. `ProductsService.listPublic`/
   * `PublicSitesController`, тот же принцип. Резолвит сущность ПО ИМЕНИ, не
   * по id (`entityName`, регистронезависимо) — публичный виджет
   * (`entitysearch`) и AI ссылаются на сущности так же, как их видит
   * владелец в дашборде ("База данных" → название), а не по внутреннему
   * UUID, который ни человек, ни модель не станут запоминать. Имена сущностей
   * СЕГОДНЯ не гарантированно уникальны в рамках бизнеса (`CreateCustomEntityDto`
   * не проверяет уникальность) — при совпадении берём самую старую
   * (`orderBy: createdAt asc`), осознанное упрощение, а не тихий баг: два
   * одноимённых блока с разным содержанием — редкий, самим владельцем
   * созданный случай, не то, что эта партия обязана решать.
   *
   * 404 одинаково и когда сущности с таким именем нет, и когда она есть, но
   * `isPublic: false` — та же "обе причины должны выглядеть одинаково для
   * анонима" дисциплина, что у `BlogPostsService.getPublicBySlug` (не
   * палим анонимному посетителю сам факт существования приватной сущности с
   * таким именем). */
  async listPublicRecords(businessId: string, entityName: string): Promise<PublicCustomEntityDto> {
    const entity = await this.prisma.customEntity.findFirst({
      where: { businessId, name: { equals: entityName, mode: 'insensitive' }, isPublic: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!entity) throw new NotFoundException('Сущность не найдена');

    const records = await this.prisma.customEntityRecord.findMany({
      where: { entityId: entity.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      entityName: entity.name,
      fields: entity.fields as unknown as CustomEntityField[],
      records: records.map((record) => ({
        id: record.id,
        data: record.data as unknown as Record<string, CustomEntityRecordValue>,
      })),
    };
  }

  async listRecords(
    businessId: string,
    entityId: string,
    ownerId: string,
  ): Promise<CustomEntityRecordDto[]> {
    await this.findOwnedEntity(businessId, entityId, ownerId);
    const records = await this.prisma.customEntityRecord.findMany({
      where: { entityId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record) => this.toRecordDto(record));
  }

  async createRecord(
    businessId: string,
    entityId: string,
    ownerId: string,
    dto: UpsertCustomEntityRecordDto,
  ): Promise<CustomEntityRecordDto> {
    const entity = await this.findOwnedEntity(businessId, entityId, ownerId);
    const data = this.parseOrBadRequest(() =>
      validateRecordData(entity.fields as unknown as CustomEntityField[], dto.data),
    );

    const record = await this.prisma.customEntityRecord.create({
      data: { entityId, data: data as never },
    });
    return this.toRecordDto(record);
  }

  async updateRecord(
    businessId: string,
    entityId: string,
    recordId: string,
    ownerId: string,
    dto: UpsertCustomEntityRecordDto,
  ): Promise<CustomEntityRecordDto> {
    const entity = await this.findOwnedEntity(businessId, entityId, ownerId);
    await this.findOwnedRecord(entityId, recordId);
    const data = this.parseOrBadRequest(() =>
      validateRecordData(entity.fields as unknown as CustomEntityField[], dto.data),
    );

    const record = await this.prisma.customEntityRecord.update({
      where: { id: recordId },
      data: { data: data as never },
    });
    return this.toRecordDto(record);
  }

  async removeRecord(
    businessId: string,
    entityId: string,
    recordId: string,
    ownerId: string,
  ): Promise<void> {
    await this.findOwnedEntity(businessId, entityId, ownerId);
    await this.findOwnedRecord(entityId, recordId);
    await this.prisma.customEntityRecord.delete({ where: { id: recordId } });
  }

  /** `lib/custom-entity-schema.lib.ts` бросает обычный `Error` (framework-
   * agnostic — тот же вызывающий код используется и AI-инструментами через
   * `parseInput`, которым `BadRequestException` ни к чему), не долетевший
   * до Nest-фильтра как есть он падал бы 500 вместо 400 (тот же приём
   * оборачивания, что `CustomWidgetsService`... собственно `parseWidgetSchema`
   * в `custom-widgets.types.ts` делает это внутри себя — здесь вынесено в
   * общий хелпер, т.к. вызывается в четырёх местах, не одном). */
  private parseOrBadRequest<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : String(error));
    }
  }

  private async assertOwnership(businessId: string, ownerId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
  }

  private async findOwnedEntity(
    businessId: string,
    entityId: string,
    ownerId: string,
  ): Promise<CustomEntity> {
    await this.assertOwnership(businessId, ownerId);
    const entity = await this.prisma.customEntity.findFirst({
      where: { id: entityId, businessId },
    });
    if (!entity) throw new NotFoundException('Сущность не найдена');
    return entity;
  }

  private async findOwnedRecord(entityId: string, recordId: string): Promise<CustomEntityRecord> {
    const record = await this.prisma.customEntityRecord.findFirst({
      where: { id: recordId, entityId },
    });
    if (!record) throw new NotFoundException('Запись не найдена');
    return record;
  }

  private toEntityDto(entity: CustomEntity): CustomEntityDto {
    return {
      id: entity.id,
      businessId: entity.businessId,
      name: entity.name,
      fields: entity.fields as unknown as CustomEntityDto['fields'],
      isPublic: entity.isPublic,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private toRecordDto(record: CustomEntityRecord): CustomEntityRecordDto {
    return {
      id: record.id,
      entityId: record.entityId,
      data: record.data as unknown as CustomEntityRecordDto['data'],
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
