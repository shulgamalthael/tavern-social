import { CreatorStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListAdminCreatorsDto {
  @IsOptional()
  @IsEnum(CreatorStatus)
  status?: CreatorStatus;
}
