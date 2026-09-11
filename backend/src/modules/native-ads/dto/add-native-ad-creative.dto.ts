import { NativeAdCreativeStyle } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, Length } from 'class-validator';

/** `imageUrl`/`videoUrl` — только уже загруженный файл, та же проверка, что
 * `AddAdCreativeDto` (`advertising` module): реальная проверка "файл
 * существует и принадлежит этому бизнесу" происходит в
 * `NativeAdCampaignsService.addCreative` через `MediaAssetsService`, не
 * здесь. */
export class AddNativeAdCreativeDto {
  @IsEnum(NativeAdCreativeStyle, { message: 'Недопустимый стиль креатива' })
  style!: NativeAdCreativeStyle;

  @IsString()
  @Length(1, 90, { message: 'Заголовок должен быть от 1 до 90 символов' })
  headline!: string;

  @IsOptional()
  @IsString()
  @Length(0, 280, { message: 'Текст не должен превышать 280 символов' })
  bodyText?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  /** Только для `style: 'video'` — тот же принцип, что `videoUrl` у
   * `AddAdCreativeDto`. */
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
