import { AdBillingModel, AdPlacement, BusinessCategory } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

/** Минимум $1 — заведомо выше минимума самого Stripe (~$0.50, см.
 * `PaymentAmountTooLowError`), так что `submitForReview` не должен упасть
 * по этой причине для честно заполненной формы; `AdCampaignsService.
 * submitForReview` всё равно перехватывает `PaymentAmountTooLowError`, как
 * и `OrdersService`, на случай изменения минимума Stripe в будущем. */
const MIN_BUDGET_CENTS = 100;

/** Валюта НЕ приходит от клиента — берётся из `Business.currency`
 * рекламодателя на backend (`AdCampaignsService.create`), тот же принцип,
 * что и у `Order`/`Appointment` (см. их сервисы): клиент не должен уметь
 * назначить бюджету произвольную валюту. */
export class CreateAdCampaignDto {
  @IsString()
  @Length(1, 120, { message: 'Название кампании должно быть от 1 до 120 символов' })
  name!: string;

  @IsInt({ message: 'Бюджет должен быть целым числом центов' })
  @Min(MIN_BUDGET_CENTS, { message: 'Минимальный бюджет — $1' })
  budgetCents!: number;

  /** Рекламодатель сам выбирает модель — платформа не навязывает одну всем
   * (см. `AdBillingModel`'s комментарий в schema.prisma). */
  @IsEnum(AdBillingModel, { message: 'billingModel должен быть cpm или cpc' })
  billingModel!: AdBillingModel;

  /** За 1000 показов (`cpm`) или за один клик (`cpc`) — то же самое поле,
   * смысл зависит от `billingModel`. Не привязано к минимуму Stripe (это не
   * отдельный платёж, а только скорость расходования уже оплаченного
   * `budgetCents`, см. её комментарий) — минимум здесь чисто по смыслу
   * "больше нуля". */
  @IsInt({ message: 'Ставка должна быть целым числом центов' })
  @Min(1, { message: 'Ставка должна быть больше 0' })
  bidCents!: number;

  /** Пусто — кампания видна на любой категории паблишера (см. `AdEngineService.
   * selectCreative`, комментарий про конкурентное исключение). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(Object.keys(BusinessCategory).length)
  @ArrayUnique()
  @IsEnum(BusinessCategory, { each: true })
  targetCategories?: BusinessCategory[];

  @IsArray({ message: 'Укажите хотя бы одно место размещения' })
  @ArrayUnique()
  @IsEnum(AdPlacement, { each: true })
  targetPlacements!: AdPlacement[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(['desktop', 'tablet', 'mobile'], { each: true })
  targetDevices?: ('desktop' | 'tablet' | 'mobile')[];

  /** ISO 3166-1 alpha-2 (`'US'`, `'UA'`) — пусто значит "любая страна".
   * Определяется по IP посетителя на выдаче (`resolveVisitorCountry`), не
   * приходит от посетителя — только рекламодатель здесь ЗАДАЁТ список
   * разрешённых стран, реальную страну ПОСЕТИТЕЛЯ подставляет `AdEngineService`
   * сам (см. её комментарий). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Matches(/^[A-Z]{2}$/, {
    each: true,
    message: 'Код страны должен быть в формате ISO 3166-1 (например, US)',
  })
  targetCountries?: string[];

  /** Декларативный флаг «18+», не проверка возраста — см. `AdCampaign.
   * isAdultContent`'s комментарий в schema.prisma. */
  @IsOptional()
  @IsBoolean()
  isAdultContent?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
