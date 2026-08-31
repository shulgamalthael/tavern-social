import { IsArray, IsString, Length } from 'class-validator';

/** `fields` типизирован как `unknown[]` здесь, не разобран глубже — та же
 * причина, что у `CreateCustomWidgetDto.schema` (AI-6): реальная форма
 * (`{ key, label, type, required? }`) валидируется в `CustomEntitiesService`
 * через `parseEntityFields` (`lib/custom-entity-schema.lib.ts`), не через
 * class-validator декораторы. */
export class CreateCustomEntityDto {
  @IsString()
  @Length(1, 120, { message: 'Название должно быть от 1 до 120 символов' })
  name!: string;

  @IsArray({ message: 'fields должен быть массивом' })
  fields!: unknown[];
}
