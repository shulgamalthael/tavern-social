import { AdBillingModel } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { CREATOR_BLOCKABLE_AD_CATEGORIES } from '@/modules/creators/creators.types';

/** Тот же минимум, что и `CreateAdCampaignDto` (`advertising` module) — см.
 * её комментарий, тот же смысл. */
const MIN_BUDGET_CENTS = 100;

/** Валюта не приходит от клиента — берётся из `Business.currency`
 * рекламодателя, тот же принцип, что `CreateAdCampaignDto`. */
export class CreateNativeAdCampaignDto {
  @IsString()
  @Length(1, 120, { message: 'Название кампании должно быть от 1 до 120 символов' })
  name!: string;

  @IsInt({ message: 'Бюджет должен быть целым числом центов' })
  @Min(MIN_BUDGET_CENTS, { message: 'Минимальный бюджет — $1' })
  budgetCents!: number;

  @IsEnum(AdBillingModel, { message: 'billingModel должен быть cpm или cpc' })
  billingModel!: AdBillingModel;

  @IsInt({ message: 'Ставка должна быть целым числом центов' })
  @Min(1, { message: 'Ставка должна быть больше 0' })
  bidCents!: number;

  /** Информационные поля для Phase 2 (см. `NativeAdCampaign`'s комментарий в
   * schema.prisma) — подсказка админу при ручном назначении, не критерий
   * автоматического подбора. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  targetCategoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  targetGeography?: string[];

  /** Против какой из `CREATOR_BLOCKABLE_AD_CATEGORIES` проверяется
   * `CreatorProfile.blockedCategories` — не указано значит
   * «неклассифицированная», никогда не блокируется этим полем. */
  @IsOptional()
  @IsIn(CREATOR_BLOCKABLE_AD_CATEGORIES)
  adCategory?: (typeof CREATOR_BLOCKABLE_AD_CATEGORIES)[number];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
