import type { CustomEntityField, CustomEntityRecordValue } from './lib/custom-entity-schema.lib';

export type { CustomEntityField, CustomEntityFieldType } from './lib/custom-entity-schema.lib';

export interface CustomEntityDto {
  id: string;
  businessId: string;
  name: string;
  fields: CustomEntityField[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomEntityRecordDto {
  id: string;
  entityId: string;
  data: Record<string, CustomEntityRecordValue>;
  createdAt: string;
  updatedAt: string;
}

/** Форма анонимного `GET /sites/:businessId/custom-entities/:name/records`
 * (`CustomEntitiesService.listPublicRecords`) — по составу полей уже, чем
 * owner-only `CustomEntityDto`+`CustomEntityRecordDto[]` вместе взятые: без
 * `id`/`businessId` самой сущности (посетителю сайта не нужен внутренний id,
 * только форма полей и сами записи), `fields` нужны, чтобы виджет поиска
 * (`entitysearch`, `entities/website/blocks/navigation`) знал, какие ключи
 * `record.data` текстовые (искать/показывать как заголовок), не строя это
 * знание в самом блоке. */
export interface PublicCustomEntityDto {
  entityName: string;
  fields: CustomEntityField[];
  records: { id: string; data: Record<string, CustomEntityRecordValue> }[];
}
