import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

/** Отдельный класс с полями `@IsOptional()` — см. `UpdateProductDto` для
 * обоснования (не используем `@nestjs/mapped-types` в проекте). */
export class UpdateBlogPostDto {
  @IsOptional()
  @IsString()
  @Length(1, 200, { message: 'Заголовок должен быть от 1 до 200 символов' })
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Slug может содержать только строчные латинские буквы, цифры и дефисы',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(0, 300, { message: 'Анонс не должен превышать 300 символов' })
  excerpt?: string;

  @IsOptional()
  @IsString()
  @Length(0, 50_000, { message: 'Текст поста не должен превышать 50 000 символов' })
  content?: string;

  @IsOptional()
  @IsString()
  coverImage?: string | null;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 200, { message: 'SEO-заголовок не должен превышать 200 символов' })
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @Length(0, 300, { message: 'SEO-описание не должно превышать 300 символов' })
  seoDescription?: string;
}
