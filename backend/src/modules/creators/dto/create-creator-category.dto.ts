import { IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

/** Тело `POST admin/creators/categories` — админ-CRUD над иерархической
 * таксономией `CreatorCategory` (изначально отложенный nice-to-have,
 * AI_PLATFORM_ROADMAP.md §79/§84: дерево сидировалось один раз, править
 * его можно было только миграцией). `slug` — kebab-case, тот же формат,
 * что уже сидированные строки (`prisma/seed-creator-categories.ts`). */
export class CreateCreatorCategoryDto {
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Slug должен быть в формате kebab-case (строчные латинские буквы, цифры, дефис)',
  })
  slug!: string;

  @IsString()
  @Length(1, 60, { message: 'Название должно быть от 1 до 60 символов' })
  label!: string;

  @IsOptional()
  @IsString()
  @Length(0, 8, { message: 'Иконка — это один эмодзи, не длинная строка' })
  icon?: string;

  /** `undefined`/отсутствует — верхний уровень дерева. */
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
