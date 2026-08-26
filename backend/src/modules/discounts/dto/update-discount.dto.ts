import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Ручной список опциональных полей — тот же приём, что `UpdateProductDto`
 * (см. её комментарий про то, почему не `PartialType`). `code`/`startsAt`/
 * `endsAt`/`usageLimit` можно явно сбросить в `null` (автоматическая скидка
 * без кода/без границ/без лимита) — сервис различает "не передано" (не
 * трогать) и "передано null" (очистить) через `!== undefined`, тот же
 * принцип, что уже применяется для `Product.stock` в `ProductsService`. */
export class UpdateDiscountDto {
  @IsOptional()
  @IsString()
  @Length(1, 120, { message: 'Название должно быть от 1 до 120 символов' })
  name?: string;

  @IsOptional()
  @IsString()
  @Length(3, 40, { message: 'Код должен быть от 3 до 40 символов' })
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Код может содержать только латинские буквы, цифры, "-" и "_"',
  })
  code?: string | null;

  @IsOptional()
  @IsIn(['percentage', 'fixed'], { message: 'Тип скидки — percentage или fixed' })
  type?: 'percentage' | 'fixed';

  @IsOptional()
  @IsInt({ message: 'Значение должно быть целым числом' })
  @Min(1, { message: 'Значение должно быть не меньше 1' })
  @Max(1_000_000_000, { message: 'Слишком большое значение' })
  value?: number;

  @IsOptional()
  @IsInt({ message: 'Минимальная сумма заказа должна быть целым числом' })
  @Min(0, { message: 'Минимальная сумма заказа не может быть отрицательной' })
  minOrderAmountCents?: number | null;

  @IsOptional()
  @IsDateString({}, { message: 'Некорректная дата начала' })
  startsAt?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'Некорректная дата окончания' })
  endsAt?: string | null;

  @IsOptional()
  @IsInt({ message: 'Лимит использований должен быть целым числом' })
  @Min(1, { message: 'Лимит использований должен быть не меньше 1' })
  usageLimit?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
