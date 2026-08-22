import { IsString, Length } from 'class-validator';

export class UpdatePostDto {
  /** Тот же контракт, что и CreatePostDto.text — см. комментарий там же. */
  @IsString()
  @Length(1, 20000, { message: 'Запись должна быть от 1 до 20000 символов' })
  text!: string;
}
