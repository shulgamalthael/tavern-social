import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @IsString()
  password!: string;
}
