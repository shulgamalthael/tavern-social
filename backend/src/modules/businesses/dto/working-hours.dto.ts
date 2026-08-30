import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { DayHoursDto } from './day-hours.dto';

/** Ключ отсутствует или всё поле `workingHours` — `null`/`undefined` целиком
 * (см. `@IsOptional()` в `UpdateBusinessDto` — он же пропускает явный
 * `null`, тот же приём, что уже проверен на `Discount.code` в Phase 13's
 * crash-testing pass) значит «закрыто в этот день» / «часы не заданы
 * вообще» соответственно — см. комментарий `Business.workingHours` в
 * schema.prisma про смысл отсутствующего значения. */
export class WorkingHoursDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursDto)
  mon?: DayHoursDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursDto)
  tue?: DayHoursDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursDto)
  wed?: DayHoursDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursDto)
  thu?: DayHoursDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursDto)
  fri?: DayHoursDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursDto)
  sat?: DayHoursDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursDto)
  sun?: DayHoursDto;
}
