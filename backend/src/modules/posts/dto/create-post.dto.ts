import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreatePostDto {
  /** Санитизированный HTML (см. common/lib/sanitize-post-content.ts) — лимит
   * поднят с 2000 до 4000, а затем до 20000: таблицы (см. `Table` в
   * `rich-html-extensions.ts`) с инлайновым `style` на каждой ячейке легко
   * дают 10-15 тысяч символов разметки при относительно скромном видимом
   * объёме данных. */
  @IsString()
  @Length(1, 20000, { message: 'Запись должна быть от 1 до 20000 символов' })
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
