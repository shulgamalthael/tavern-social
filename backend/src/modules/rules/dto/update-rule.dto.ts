import { IsArray, IsBoolean, IsOptional, IsString, Length } from 'class-validator';

/** Ручной список опциональных полей — тот же приём, что `UpdateDiscountDto`
 * (см. её комментарий про то, почему не `PartialType`). `trigger` НЕ
 * редактируется здесь намеренно — смена триггера у уже созданного правила
 * меняет, какие поля вообще доступны в `condition` (см. `RULE_TRIGGER_
 * CONTEXT_FIELDS`), проще и честнее пересоздать правило, чем разбираться со
 * старым условием, ссылающимся на несуществующие для нового триггера поля. */
export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  @Length(1, 120, { message: 'Название должно быть от 1 до 120 символов' })
  name?: string;

  @IsOptional()
  @IsArray({ message: 'condition должен быть массивом или null' })
  condition?: unknown[] | null;

  @IsOptional()
  @IsArray({ message: 'actions должен быть массивом' })
  actions?: unknown[];

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
