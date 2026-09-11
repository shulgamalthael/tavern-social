import { AdPlacement } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

/** `?placement=&device=` — используется анонимным `GET /sites/:businessId/
 * ads/select` (`PublicSitesController`, см. `AdEngineService.selectCreative`).
 * `device` — свободная строка, не enum: сегодня только для будущего
 * ranking/аналитики (`AdEngineService`'s комментарий про `device`), не для
 * фильтрации, поэтому строгий enum здесь был бы преждевременным. */
export class SelectAdQueryDto {
  @IsEnum(AdPlacement, { message: 'Недопустимое место размещения' })
  placement!: AdPlacement;

  @IsOptional()
  @IsString()
  @Length(0, 30)
  device?: string;

  @IsOptional()
  @IsString()
  @Length(0, 20)
  locale?: string;
}
