import { IsBoolean } from 'class-validator';

export class SetSuperAdminDto {
  @IsBoolean({ message: 'isSuperAdmin должно быть true или false' })
  isSuperAdmin!: boolean;
}
