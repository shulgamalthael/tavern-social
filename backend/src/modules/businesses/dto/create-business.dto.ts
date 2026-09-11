import { BusinessCategory } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { SUPPORTED_CURRENCY_CODES } from '@/modules/currencies/currencies';

export class CreateBusinessDto {
  @IsString()
  @Length(1, 120, { message: 'Название должно быть от 1 до 120 символов' })
  name!: string;

  /** Необязателен — если не передан или уже занят, сервис сам подбирает
   * свободный slug из названия (см. `BusinessesService.resolveSlug`). */
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Slug может содержать только строчные латинские буквы, цифры и дефисы',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000, { message: 'Описание не должно превышать 2000 символов' })
  description?: string;

  @IsEnum(BusinessCategory, { message: 'Недопустимая категория' })
  category!: BusinessCategory;

  /** Необязательна — если не передана, backend подставляет `DEFAULT_
   * BUSINESS_CURRENCY` (см. `BusinessesService.create`). Форма создания
   * бизнеса на frontend всегда шлёт выбранное значение (Currency System,
   * ROADMAP.md §8) — необязательность здесь только про устойчивость самого
   * API-контракта к другим будущим вызывающим кодам. */
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCY_CODES, { message: 'Неподдерживаемая валюта' })
  currency?: string;

  /** Только облегчённый кабинет рекламодателя (`POST /businesses` из
   * `/advertise/new`) шлёт `true` — см. `Business.isAdvertiserOnly`'s
   * комментарий в schema.prisma. Обычная форма «Создать бизнес» это поле
   * никогда не отправляет, поэтому `undefined` (не хранится в БД как
   * `false` вручную — сам Prisma `@default(false)` уже это делает). */
  @IsOptional()
  @IsBoolean()
  isAdvertiserOnly?: boolean;
}
