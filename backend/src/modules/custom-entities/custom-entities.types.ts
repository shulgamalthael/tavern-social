import type { CustomEntityField, CustomEntityRecordValue } from './lib/custom-entity-schema.lib';

export type { CustomEntityField, CustomEntityFieldType } from './lib/custom-entity-schema.lib';

export interface CustomEntityDto {
  id: string;
  businessId: string;
  name: string;
  fields: CustomEntityField[];
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
