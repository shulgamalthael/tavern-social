import { GroupType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @Length(1, 100, { message: 'Название должно быть от 1 до 100 символов' })
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000, { message: 'Описание не должно превышать 2000 символов' })
  description?: string;

  @IsOptional()
  @IsEnum(GroupType, { message: 'Тип группы должен быть open или private' })
  type?: GroupType;
}
