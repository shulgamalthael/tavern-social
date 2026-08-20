import { IsString, Length } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @Length(1, 2000, { message: 'Сообщение должно быть от 1 до 2000 символов' })
  text!: string;
}
