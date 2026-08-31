import { IsArray, IsString, Length } from 'class-validator';

/** `schema` типизирован как `unknown[]` здесь, не разобран глубже — та же
 * причина, что у `CreateRuleDto.condition`/`.actions` (AI-5): реальная форма
 * (union из 4 curated типов блоков) валидируется в `CustomWidgetsService`
 * через `parseWidgetSchema` (`custom-widgets.types.ts`), не через
 * class-validator декораторы. */
export class CreateCustomWidgetDto {
  @IsString()
  @Length(1, 120, { message: 'Название должно быть от 1 до 120 символов' })
  name!: string;

  @IsArray({ message: 'schema должен быть массивом' })
  schema!: unknown[];
}
