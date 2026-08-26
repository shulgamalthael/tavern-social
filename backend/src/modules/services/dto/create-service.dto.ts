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

export class CreateServiceDto {
  @IsString()
  @Length(1, 120, { message: 'Название должно быть от 1 до 120 символов' })
  name!: string;

  /** Необязателен — см. `CreateProductDto.slug`, тот же приём подбора
   * свободного slug в рамках бизнеса. */
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

  @IsInt({ message: 'Длительность должна быть целым числом минут' })
  @Min(5, { message: 'Длительность должна быть не меньше 5 минут' })
  @Max(1440, { message: 'Длительность не может превышать сутки' })
  durationMinutes!: number;

  @IsInt({ message: 'Цена должна быть целым числом (в копейках)' })
  @Min(0, { message: 'Цена не может быть отрицательной' })
  @Max(1_000_000_000, { message: 'Слишком большая цена' })
  priceCents!: number;

  /** Пути загруженных файлов, не абсолютные URL — см. комментарий
   * `CreateProductDto.images`, та же причина. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
