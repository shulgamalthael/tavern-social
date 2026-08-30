import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChatRequestDto {
  @IsString()
  @MinLength(1, { message: 'Сообщение не может быть пустым' })
  @MaxLength(4000, { message: 'Сообщение слишком длинное' })
  message!: string;
}
