import { IsOptional, IsString, Length } from 'class-validator';

export class BanUserDto {
  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Причина — не больше 500 символов' })
  reason?: string;
}
