import { IsString, Length } from 'class-validator';

export class UpdatePostDto {
  /** Тот же контракт, что и CreatePostDto.text — см. комментарий там же. */
  @IsString()
  @Length(1, 4000, { message: 'Запись должна быть от 1 до 4000 символов' })
  text!: string;
}
