import { IsOptional, IsString, Length } from 'class-validator';

/** Тело `POST admin/native-ads/campaigns/:id/reject` И `.../creatives/:id/
 * reject` — та же форма, что `RejectAdCampaignDto` (`advertising` module),
 * продублирована намеренно, не импортирована оттуда: модуль независим от
 * `advertising`, см. `native-ads.module.ts`'s комментарий. */
export class RejectNativeAdCampaignDto {
  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Причина отклонения не должна превышать 500 символов' })
  reason?: string;
}
