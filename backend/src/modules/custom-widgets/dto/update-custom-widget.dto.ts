import { CustomWidgetStatus } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class UpdateCustomWidgetDto {
  @IsOptional()
  @IsString()
  @Length(1, 120, { message: 'Название должно быть от 1 до 120 символов' })
  name?: string;

  @IsOptional()
  @IsArray({ message: 'schema должен быть массивом' })
  schema?: unknown[];

  /** См. `CreateCustomWidgetDto.fields` — реальная валидация формы каждого
   * элемента (`WidgetFieldSchema`) в `parseWidgetFields`, не здесь. */
  @IsOptional()
  @IsArray({ message: 'fields должен быть массивом' })
  fields?: unknown[];

  @IsOptional()
  @IsEnum(CustomWidgetStatus, { message: 'Недопустимый статус' })
  status?: CustomWidgetStatus;
}
