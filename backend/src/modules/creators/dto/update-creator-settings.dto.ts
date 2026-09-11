import { CreatorAdFrequency } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { CREATOR_BLOCKABLE_AD_CATEGORIES } from '../creators.types';

/** Partial по смыслу — владелец обычно шлёт одно-два поля разом (тот же
 * приём, что `UpdateCustomWidgetDto`/`buildValidatedStyle`: незатронутые
 * поля не трогаются, `CreatorsService.updateSettings` мёржит поверх
 * текущих значений, а не заменяет объект целиком). */
export class UpdateCreatorSettingsDto {
  @IsOptional()
  @IsBoolean()
  monetizationEnabled?: boolean;

  @IsOptional()
  @IsEnum(CreatorAdFrequency, { message: 'adFrequency должен быть одним из: low, balanced, high' })
  adFrequency?: CreatorAdFrequency;

  @IsOptional()
  @IsInt()
  @Min(1, { message: '1 реклама минимум на 1 пост' })
  @Max(20, { message: '1 реклама максимум на 20 постов' })
  maxAdFrequencyRatio?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(CREATOR_BLOCKABLE_AD_CATEGORIES, { each: true })
  blockedCategories?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  blockedAdvertiserIds?: string[];
}
