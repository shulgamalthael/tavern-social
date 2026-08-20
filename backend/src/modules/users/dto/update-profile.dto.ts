import { ArrayMaxSize, IsArray, IsOptional, IsString, Length } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @Length(2, 60, { message: 'Имя должно быть от 2 до 60 символов' })
  name!: string;

  @IsString()
  @Length(0, 120, { message: 'Подпись слишком длинная' })
  tagline!: string;

  @IsOptional()
  @IsString()
  @Length(0, 600, { message: 'Рассказ о себе слишком длинный' })
  about?: string;

  @IsOptional()
  @IsString()
  @Length(0, 80, { message: 'Название города слишком длинное' })
  city?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12, { message: 'Слишком много тегов' })
  @IsString({ each: true })
  tags?: string[];
}
