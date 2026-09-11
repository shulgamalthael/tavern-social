import { IsOptional, IsString, Length } from 'class-validator';

/** Тело `POST admin/advertising/campaigns/:id/reject` И `POST admin/
 * advertising/creatives/:id/reject` — та же форма, тот же смысл `reason` на
 * обоих уровнях (`AdCampaign.rejectionReason`/`AdCreative.rejectionReason`),
 * переиспользуется, а не дублируется отдельной DTO под каждый уровень.
 * Approve не нуждается в собственной DTO — у него нет полей. */
export class RejectAdCampaignDto {
  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Причина отклонения не должна превышать 500 символов' })
  reason?: string;
}
