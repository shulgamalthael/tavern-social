import { ArrayMaxSize, ArrayUnique, IsArray, IsOptional, IsString } from 'class-validator';
import { MAX_ADDITIONAL_CATEGORIES } from '../creators.types';

export class StartCreatorOnboardingDto {
  @IsString()
  primaryCategoryId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ADDITIONAL_CATEGORIES, {
    message: `Дополнительных категорий не может быть больше ${MAX_ADDITIONAL_CATEGORIES}`,
  })
  @ArrayUnique()
  @IsString({ each: true })
  additionalCategoryIds?: string[];
}
