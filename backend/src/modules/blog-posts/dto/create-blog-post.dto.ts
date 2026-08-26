import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateBlogPostDto {
  @IsString()
  @Length(1, 200, { message: 'Заголовок должен быть от 1 до 200 символов' })
  title!: string;

  /** Необязателен — см. `CreateProductDto.slug`, тот же приём подбора
   * свободного slug в рамках бизнеса. */
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

  /** Обычный текст с пустой строкой между абзацами, не HTML — см.
   * комментарий модели `BlogPost` в schema.prisma о том, почему здесь нет
   * полноценного WYSIWYG-редактора в этом инкременте. */
  @IsOptional()
  @IsString()
  @Length(0, 50_000, { message: 'Текст поста не должен превышать 50 000 символов' })
  content?: string;

  /** Путь загруженного файла, не абсолютный URL — см. комментарий
   * `CreateProductDto.images`, та же причина. */
  @IsOptional()
  @IsString()
  coverImage?: string | null;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  /** См. комментарий столбцов `BlogPost.seoTitle`/`seoDescription` в
   * schema.prisma — необязательное переопределение метаданных страницы
   * чтения, `undefined`/пусто значит «используй title/excerpt». */
  @IsOptional()
  @IsString()
  @Length(0, 200, { message: 'SEO-заголовок не должен превышать 200 символов' })
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @Length(0, 300, { message: 'SEO-описание не должно превышать 300 символов' })
  seoDescription?: string;
}
