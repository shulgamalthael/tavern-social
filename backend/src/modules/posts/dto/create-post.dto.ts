import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreatePostDto {
  /** Санитизированный HTML (см. common/lib/sanitize-post-content.ts) — лимит
   * поднят с 2000 до 4000: разметка форматирования/картинок увеличивает
   * длину строки при том же видимом объёме текста. */
  @IsString()
  @Length(1, 4000, { message: 'Запись должна быть от 1 до 4000 символов' })
  text!: string;

  /** Чья стена — если не задано и `groupId` тоже не задан, пост публикуется
   * на своей же стене (см. PostsService.create). Взаимоисключающе с `groupId`. */
  @IsOptional()
  @IsUUID()
  wallOwnerId?: string;

  /** Публикация в группе вместо стены — взаимоисключающе с `wallOwnerId`
   * (см. PostsService.create). Публиковать может только участник группы
   * (владелец или обычный участник), backend проверяет членство сам.
   * `@IsString()`, не `@IsUUID()` — в отличие от `User.id`, `Group.id` не
   * гарантированно UUID (сид-группы используют читаемые строковые id, см.
   * `prisma/seed.ts`); `@IsUUID()` здесь заблокировал бы публикацию их
   * реальным участникам. */
  @IsOptional()
  @IsString()
  groupId?: string;
}
