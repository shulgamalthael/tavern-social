import { IsString, Length } from 'class-validator';

/** Тело `POST /sites/:businessId/ads/impression|click` — анонимный
 * fire-and-forget вызов после того, как креатив реально отрендерился/по
 * нему кликнули (см. `AdSlotRenderer` на frontend), не блокирует сам ответ
 * `ads/select`. */
export class RecordAdEventDto {
  @IsString()
  @Length(1, 100)
  campaignId!: string;

  @IsString()
  @Length(1, 100)
  creativeId!: string;
}
