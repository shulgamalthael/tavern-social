import { IsEmail, IsString, Length } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @IsString()
  @Length(8, 72, { message: 'Пароль должен быть от 8 до 72 символов' })
  password!: string;

  @IsString()
  @Length(2, 60, { message: 'Имя должно быть от 2 до 60 символов' })
  name!: string;
}
