import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @Length(1, 1000, { message: 'Комментарий должен быть от 1 до 1000 символов' })
  text!: string;

  /** id комментария, на который отвечают — сервис сам сведёт вложенность к
   * одному уровню (см. PostsService.createComment). */
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
