import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { LOOSE_PHONE_MESSAGE, LOOSE_PHONE_PATTERN } from '@/common/lib/phone-validation';

/** Только `productId`/`quantity` — НИКАКИХ `name`/`priceCents` от клиента:
 * анонимный посетитель мог бы прислать любую цену на любой товар. Реальные
 * имя/цена подставляются на backend из текущего `Product` (см.
 * `OrdersService.createFromCart`). */
export class CreateOrderItemDto {
  @IsString()
  productId!: string;

  @IsInt({ message: 'Количество должно быть целым числом' })
  @Min(1, { message: 'Количество должно быть не меньше 1' })
  @Max(999, { message: 'Слишком большое количество' })
  quantity!: number;
}

export class CreateOrderDto {
  @IsString()
  @Length(1, 120, { message: 'Укажите имя' })
  customerName!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Некорректный email' })
  customerEmail?: string;

  @IsOptional()
  @Matches(LOOSE_PHONE_PATTERN, { message: LOOSE_PHONE_MESSAGE })
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000, { message: 'Комментарий не должен превышать 1000 символов' })
  customerNote?: string;

  /** Промокод, если покупатель ввёл — сравнивается и пересчитывается заново
   * на backend (см. `OrdersService.createFromCart`/`PRICING_ARCHITECTURE.md`
   * §5), результат превью-эндпоинта (`POST /sites/:businessId/coupons/preview`)
   * НИКОГДА не подставляется напрямую в заказ. */
  @IsOptional()
  @IsString()
  @Length(1, 40)
  couponCode?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'В заказе должен быть хотя бы один товар' })
  @ArrayMaxSize(50, { message: 'Слишком много позиций в одном заказе' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
