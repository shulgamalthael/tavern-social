import { IsString, Length } from 'class-validator';

/** Тело `POST native-ads/my-revenue/request-payout` — одна выплата, одна
 * валюта (Stripe Transfer не смешивает валюты, см. `NativeAdPayout`'s
 * комментарий в schema.prisma). Creator с балансом в нескольких валютах
 * запрашивает выплату по каждой отдельно. */
export class RequestNativeAdPayoutDto {
  @IsString()
  @Length(3, 3, { message: 'Код валюты должен состоять из 3 символов' })
  currency!: string;
}
