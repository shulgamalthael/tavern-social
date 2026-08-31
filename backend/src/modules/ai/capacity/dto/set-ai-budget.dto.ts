import { AiBudgetScope } from '@prisma/client';
import { IsEnum, IsInt, IsString, Min, ValidateIf } from 'class-validator';

export class SetAiBudgetDto {
  @IsEnum(AiBudgetScope, { message: 'scope должен быть global или business' })
  scope!: AiBudgetScope;

  @ValidateIf((dto: SetAiBudgetDto) => dto.scope === 'business')
  @IsString({ message: 'businessId обязателен для scope=business' })
  businessId?: string;

  @IsInt()
  @Min(1)
  monthlyLimitCents!: number;
}
