import { IsInt, IsString, Length, Min } from 'class-validator';

/** Тело превью-эндпоинта купона (`PublicSitesController.previewCoupon`, см.
 * `PRICING_ARCHITECTURE.md` §5) — `subtotalCents` здесь ТОЛЬКО для проверки
 * `minOrderAmountCents` в предпросмотре, не источник истины: реальная сумма
 * пересчитывается заново из актуальных `Product` при настоящем оформлении
 * заказа (`OrdersService.createFromCart`), этот эндпоинт ничего не резервирует
 * и не списывает. */
export class CouponPreviewDto {
  @IsString()
  @Length(1, 40)
  code!: string;

  @IsInt({ message: 'Сумма должна быть целым числом' })
  @Min(0, { message: 'Сумма не может быть отрицательной' })
  subtotalCents!: number;
}
