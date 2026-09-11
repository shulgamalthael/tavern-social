import { IsIn, IsInt, Min } from 'class-validator';
import { SUPPORTED_CURRENCY_CODES } from '@/modules/currencies/currencies';

/** Тот же минимум ($1), что и `CreateAdCampaignDto` — запас над реальным
 * минимумом Stripe (~$0.50), см. её комментарий. */
const MIN_BUDGET_CENTS = 100;

/** Куратированный набор, не свободное число — тот же принцип, что и у
 * `AdPlacement`/размеров плейсментов в Advertising Infrastructure. */
const ALLOWED_DURATION_DAYS = [1, 3, 5, 7] as const;

export class CreatePostBoostDto {
  @IsInt({ message: 'Бюджет должен быть целым числом центов' })
  @Min(MIN_BUDGET_CENTS, { message: 'Минимальный бюджет — $1' })
  budgetCents!: number;

  /** У `User`, в отличие от `Business`, нет собственного поля валюты —
   * выбирается прямо в форме продвижения, снэпшотится на `PostBoost`. */
  @IsIn(SUPPORTED_CURRENCY_CODES, { message: 'Неподдерживаемая валюта' })
  currency!: string;

  @IsIn(ALLOWED_DURATION_DAYS, { message: 'Длительность должна быть 1, 3, 5 или 7 дней' })
  durationDays!: number;
}
