import { IsInt, Max, Min } from 'class-validator';

/** Три Bps ДОЛЖНЫ суммироваться ровно в 10000 (100%) — иначе
 * `splitRevenue`'s остаток (`processingFeeCents`) начал бы либо терять
 * центы, либо тихо превращаться в скрытую четвёртую долю. Проверяется в
 * сервисе (`NativeAdRevenueSettingsService.update`), не декоратором класса
 * — class-validator не умеет кросс-полевые правила без дополнительного
 * пакета, а плодить его ради одной проверки не стоит. */
export class UpdateNativeAdRevenueSettingsDto {
  @IsInt({ message: "Доля creator'а должна быть целым числом базисных пунктов" })
  @Min(0)
  @Max(10000)
  creatorRevenueShareBps!: number;

  @IsInt({ message: 'Комиссия платформы должна быть целым числом базисных пунктов' })
  @Min(0)
  @Max(10000)
  platformFeeBps!: number;

  @IsInt({ message: 'Комиссия обработки платежа должна быть целым числом базисных пунктов' })
  @Min(0)
  @Max(10000)
  paymentProcessingFeeBps!: number;

  @IsInt({ message: 'Минимальная сумма выплаты должна быть целым числом центов' })
  @Min(0)
  minimumPayoutCents!: number;
}
