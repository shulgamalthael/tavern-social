import { RuleTrigger } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';

/** `condition`/`actions` намеренно типизированы как `unknown[]`/необязательный
 * массив здесь, не разобраны глубже class-validator декораторами — их
 * реальная форма (union действий, набор допустимых операторов) валидируется
 * в `RulesService` через `parseRuleCondition`/`parseRuleActions`
 * (`rules.types.ts`), тем же приёмом, что AI-инструменты валидируют свои
 * аргументы в `parseInput`, а не через DTO — см. её комментарий про то,
 * почему: JSON-blob произвольной вложенности неудобно и негибко описывать
 * декораторами class-validator, ошибка от ручного парсера тоже понятнее. */
export class CreateRuleDto {
  @IsString()
  @Length(1, 120, { message: 'Название должно быть от 1 до 120 символов' })
  name!: string;

  @IsEnum(RuleTrigger, { message: 'Недопустимый триггер' })
  trigger!: RuleTrigger;

  @IsOptional()
  @IsArray({ message: 'condition должен быть массивом' })
  condition?: unknown[];

  @IsArray({ message: 'actions должен быть массивом' })
  actions!: unknown[];

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
