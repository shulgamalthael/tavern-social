import { IsString, Length } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @Length(1, 1000, { message: 'Комментарий должен быть от 1 до 1000 символов' })
  text!: string;
}
