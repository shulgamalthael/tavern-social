import { IsString, Length } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @Length(1, 2000, { message: 'Запись должна быть от 1 до 2000 символов' })
  text!: string;
}
