import { IsString } from 'class-validator';

export class ExchangeOAuthCodeDto {
  @IsString()
  code!: string;
}
