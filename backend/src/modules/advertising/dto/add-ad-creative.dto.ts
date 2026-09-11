import { AdFormat } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, Length } from 'class-validator';

/** `imageUrl` — только уже загруженный файл через существующий upload
 * пайплайн (`MediaAssetsService`/`upload-business-image`-стиль эндпоинт),
 * не произвольный внешний URL — см. `AdCampaignsService.addCreative`,
 * которая (как и `image`-поле Builder'а) не проверяет здесь домен, потому
 * что реальная проверка "файл существует и принадлежит этому бизнесу"
 * происходит на уровне медиа-загрузки, а не на уровне этой DTO.
 *
 * `format`/`headline` необязательны на уровне DTO — при заданном
 * `productId` (карточка товара) они выводятся сервером из самого товара,
 * а не приходят от клиента (см. `AdCampaignsService.addCreative`, где и
 * живёт реальная XOR-проверка «или productId, или format+headline», тем
 * же приёмом, что уже сделан для video/imageUrl чуть ниже). */
export class AddAdCreativeDto {
  @IsOptional()
  @IsEnum(AdFormat, { message: 'Недопустимый формат креатива' })
  format?: AdFormat;

  @IsOptional()
  @IsString()
  @Length(1, 90, { message: 'Заголовок должен быть от 1 до 90 символов' })
  headline?: string;

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

  /** Карточка товара — id существующего `Product` этого же бизнеса
   * (`AdCampaignsService.addCreative` проверяет владельца/`isActive`).
   * Когда задан, `format`/`headline`/`description`/`imageUrl` игнорируются,
   * даже если клиент их всё же прислал — сервер снимает слепок с товара
   * сам, а не доверяет присланным полям (см. комментарий класса). */
  @IsOptional()
  @IsString()
  productId?: string;
}
