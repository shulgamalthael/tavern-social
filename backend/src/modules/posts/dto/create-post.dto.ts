import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @Length(1, 2000, { message: 'Запись должна быть от 1 до 2000 символов' })
  text!: string;

  /** Чья стена — если не задано, пост публикуется на своей же (см.
   * PostsService.create). */
  @IsOptional()
  @IsUUID()
  wallOwnerId?: string;
}
