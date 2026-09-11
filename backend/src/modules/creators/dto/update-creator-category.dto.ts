import { IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

/** Тело `PATCH admin/creators/categories/:id`. `parentId: ''` — явно
 * переместить категорию на верхний уровень (пустая строка, не `null`:
 * `class-validator`'s `@IsString()` иначе отклонил бы `null`, а различать
 * "не трогать" (поле отсутствует) от "очистить" нужно двумя разными
 * значениями, не одним `undefined`). */
export class UpdateCreatorCategoryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Slug должен быть в формате kebab-case (строчные латинские буквы, цифры, дефис)',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60, { message: 'Название должно быть от 1 до 60 символов' })
  label?: string;

  @IsOptional()
  @IsString()
  @Length(0, 8, { message: 'Иконка — это один эмодзи, не длинная строка' })
  icon?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
