import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Отдельный класс с полями, каждое из которых `@IsOptional()` (тот же
 * подход, что и у `UpdateBusinessDto`), а не `PartialType(CreateProductDto)`
 * — в проекте не используется `@nestjs/mapped-types`, а заводить новую
 * зависимость ради одного DTO, когда рядом уже есть проверенный паттерн
 * (ручной список опциональных полей), не стоит. */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Length(1, 120, { message: 'Название должно быть от 1 до 120 символов' })
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Slug может содержать только строчные латинские буквы, цифры и дефисы',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(0, 4000, { message: 'Описание не должно превышать 4000 символов' })
  description?: string;

  @IsOptional()
  @IsInt({ message: 'Цена должна быть целым числом (в копейках)' })
  @Min(0, { message: 'Цена не может быть отрицательной' })
  @Max(1_000_000_000, { message: 'Слишком большая цена' })
  priceCents?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsInt({ message: 'Остаток должен быть целым числом' })
  @Min(0, { message: 'Остаток не может быть отрицательным' })
  stock?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
