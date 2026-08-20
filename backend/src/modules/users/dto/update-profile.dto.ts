import { IsString, Length } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @Length(2, 60, { message: 'Имя должно быть от 2 до 60 символов' })
  name!: string;

  @IsString()
  @Length(0, 120, { message: 'Подпись слишком длинная' })
  tagline!: string;
}
