import { IsObject } from 'class-validator';

/** `field` — та же "outer shape через DTO, внутренняя форма через ручной
 * парсер" схема, что `CreateCustomEntityDto.fields` — валидируется в
 * `CustomEntitiesService.addField` через `appendField`. */
export class AddCustomEntityFieldDto {
  @IsObject({ message: 'field должен быть объектом { key, label, type, required? }' })
  field!: Record<string, unknown>;
}
