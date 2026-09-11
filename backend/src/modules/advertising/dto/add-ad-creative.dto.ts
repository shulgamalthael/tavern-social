import { AdFormat } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, Length } from 'class-validator';

/** `imageUrl` — только уже загруженный файл через существующий upload
 * пайплайн (`MediaAssetsService`/`upload-business-image`-стиль эндпоинт),
 * не произвольный внешний URL — см. `AdCampaignsService.addCreative`,
 * которая (как и `image`-поле Builder'а) не проверяет здесь домен, потому
 * что реальная проверка "файл существует и принадлежит этому бизнесу"
 * происходит на уровне медиа-загрузки, а не на уровне этой DTO. */
export class AddAdCreativeDto {
  @IsEnum(AdFormat, { message: 'Недопустимый формат креатива' })
  format!: AdFormat;

  @IsString()
  @Length(1, 90, { message: 'Заголовок должен быть от 1 до 90 символов' })
  headline!: string;

  @IsOptional()
  @IsString()
  @Length(0, 200, { message: 'Описание не должно превышать 200 символов' })
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  /** Только для `format: 'video'` — та же проверка "уже загруженный файл
   * этого бизнеса", что и `imageUrl` (см. `AdCampaignsService.addCreative`,
   * которая требует РОВНО ОДНО из двух в зависимости от `format`, а не
   * проверяет домен здесь). */
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  @Length(0, 30, { message: 'Текст кнопки не должен превышать 30 символов' })
  ctaLabel?: string;

  @IsUrl({}, { message: 'targetUrl должен быть корректным URL' })
  targetUrl!: string;
}
