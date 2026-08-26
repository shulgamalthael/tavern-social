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

export class CreateDiscountDto {
  @IsString()
  @Length(1, 120, { message: 'Название должно быть от 1 до 120 символов' })
  name!: string;

  /** `null`/не передан — автоматическая скидка (см. `Discount.code` в схеме).
   * Нормализуется в верхний регистр в сервисе, не здесь — валидация не
   * должна незаметно менять значение до вызова сервиса. */
  @IsOptional()
  @IsString()
  @Length(3, 40, { message: 'Код должен быть от 3 до 40 символов' })
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Код может содержать только латинские буквы, цифры, "-" и "_"',
  })
  code?: string;

  @IsIn(['percentage', 'fixed'], { message: 'Тип скидки — percentage или fixed' })
  type!: 'percentage' | 'fixed';

  /** percentage: 1-100. fixed: минимальные единицы валюты бизнеса — верхняя
   * граница та же, что у `Product.priceCents`, скидка не может быть больше
   * разумной цены товара. */
  @IsInt({ message: 'Значение должно быть целым числом' })
  @Min(1, { message: 'Значение должно быть не меньше 1' })
  @Max(1_000_000_000, { message: 'Слишком большое значение' })
  value!: number;

  @IsOptional()
  @IsInt({ message: 'Минимальная сумма заказа должна быть целым числом' })
  @Min(0, { message: 'Минимальная сумма заказа не может быть отрицательной' })
  minOrderAmountCents?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Некорректная дата начала' })
  startsAt?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Некорректная дата окончания' })
  endsAt?: string;

  @IsOptional()
  @IsInt({ message: 'Лимит использований должен быть целым числом' })
  @Min(1, { message: 'Лимит использований должен быть не меньше 1' })
  usageLimit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
