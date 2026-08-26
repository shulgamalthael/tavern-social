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

export class CreateProductDto {
  @IsString()
  @Length(1, 120, { message: 'Название должно быть от 1 до 120 символов' })
  name!: string;

  /** Необязателен — если не передан или уже занят в рамках этого бизнеса,
   * сервис сам подбирает свободный slug из названия (тот же приём, что и у
   * `BusinessesService.resolveSlug`, но уникальность здесь только в рамках
   * одного бизнеса — `@@unique([businessId, slug])`, не глобально). */
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

  /** В минимальных денежных единицах (копейках) — см. комментарий модели
   * `Product` в schema.prisma про то, почему не `Float`. */
  @IsInt({ message: 'Цена должна быть целым числом (в копейках)' })
  @Min(0, { message: 'Цена не может быть отрицательной' })
  @Max(1_000_000_000, { message: 'Слишком большая цена' })
  priceCents!: number;

  /** Пути загруженных файлов (`/uploads/products/...`, см. `uploadedFileUrl`
   * в `common/lib/upload.ts`) — относительные, не абсолютные URL, поэтому
   * `@IsString`, не `@IsUrl` (та же причина, что и у `Business.logoUrl`/
   * `faviconUrl` — те вообще не проходят через DTO-валидацию строки, здесь
   * это неизбежно, так как фото несколько и хранятся массивом на самом
   * продукте, а не отдельным upload-эндпоинтом на одно поле). */
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
