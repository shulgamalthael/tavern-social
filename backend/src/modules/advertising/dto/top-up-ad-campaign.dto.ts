import { IsInt, Min } from 'class-validator';

/** Минимум $1 — тот же порог и то же обоснование, что `CreateAdCampaignDto.
 * budgetCents` (заведомо выше Stripe's own ~$0.50 минимума, см.
 * `PaymentAmountTooLowError`). Валюта НЕ приходит от клиента — всегда
 * `AdCampaign.currency` (см. `AdCampaignsService.requestTopUp`), та же
 * причина, что и у `CreateAdCampaignDto`. */
const MIN_TOP_UP_CENTS = 100;

export class TopUpAdCampaignDto {
  @IsInt({ message: 'Сумма доплаты должна быть целым числом центов' })
  @Min(MIN_TOP_UP_CENTS, { message: 'Минимальная доплата — $1' })
  amountCents!: number;
}
