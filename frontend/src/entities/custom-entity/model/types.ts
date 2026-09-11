/** Custom Database Builder v1 (AI_PLATFORM_ROADMAP.md §2.2/§19, AI-8 первый
 * ограниченный слайс) — зеркалит backend `CustomEntityDto`/`CustomEntityRecordDto`
 * (`modules/custom-entities`), frontend/backend не делят типы. */
export const CUSTOM_ENTITY_FIELD_TYPES = ['string', 'number', 'boolean', 'date'] as const;
export type CustomEntityFieldType = (typeof CUSTOM_ENTITY_FIELD_TYPES)[number];

export const CUSTOM_ENTITY_FIELD_TYPE_LABELS: Record<CustomEntityFieldType, string> = {
  string: 'Текст',
  number: 'Число',
  boolean: 'Да / нет',
  date: 'Дата',
};

export interface CustomEntityField {
  key: string;
  label: string;
  type: CustomEntityFieldType;
  required: boolean;
}

export interface CustomEntity {
  id: string;
  businessId: string;
  name: string;
  fields: CustomEntityField[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CustomEntityRecordValue = string | number | boolean;

export interface CustomEntityRecord {
  id: string;
  entityId: string;
  data: Record<string, CustomEntityRecordValue>;
  createdAt: string;
  updatedAt: string;
}

/** Форма анонимного `GET /sites/:businessId/custom-entities/:name/records`
 * (см. backend `PublicCustomEntityDto`, `modules/custom-entities`) —
 * единственный публичный потребитель сегодня — виджет поиска
 * (`entitysearch`, `entities/website/blocks/navigation`). Уже, чем owner-
 * only `CustomEntity`+`CustomEntityRecord[]`: без `id`/`businessId` самой
 * сущности, они анонимному посетителю не нужны. */
export interface PublicCustomEntity {
  entityName: string;
  fields: CustomEntityField[];
  records: { id: string; data: Record<string, CustomEntityRecordValue> }[];
}
