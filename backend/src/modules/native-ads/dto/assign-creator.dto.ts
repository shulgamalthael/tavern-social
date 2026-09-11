import { IsString, Length } from 'class-validator';

/** Тело `POST admin/native-ads/campaigns/:campaignId/assign` — "manual
 * creator↔campaign assignment only, no AI yet" (корневой план фичи, Phase
 * 2): админ вручную выбирает `creatorProfileId` для конкретной кампании. */
export class AssignCreatorDto {
  @IsString()
  @Length(1, 200)
  creatorProfileId!: string;
}
