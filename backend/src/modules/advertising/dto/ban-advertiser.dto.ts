import { IsOptional, IsString, Length } from 'class-validator';

/** Тело `POST admin/advertising/businesses/:businessId/ban` — `reason`
 * попадает в `AdvertiserBan.reason`, виден только администраторам
 * (`listBannedAdvertisers`), не самому забаненному бизнесу через обычный
 * API (см. `AdCampaignsService.assertNotBannedAdvertiser`). */
export class BanAdvertiserDto {
  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Причина бана не должна превышать 500 символов' })
  reason?: string;
}
