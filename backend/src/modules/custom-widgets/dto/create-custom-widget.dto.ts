import { IsArray, IsOptional, IsString, Length } from 'class-validator';

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

  /** Необязательная схема параметров виджета (см. `WidgetFieldSchema`,
   * `custom-widgets/widget-fields.ts`) — реальная валидация формы каждого
   * элемента в `parseWidgetFields`, не здесь (та же причина, что и у
   * `schema` выше: реальная форма зависит от `kind`, не class-validator
   * декораторов). Отсутствует/пуст — виджет без параметров, статичный
   * снимок, как раньше. */
  @IsOptional()
  @IsArray({ message: 'fields должен быть массивом' })
  fields?: unknown[];
}
