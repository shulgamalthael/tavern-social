import { IsString, Length } from 'class-validator';

/** Тело `POST native-ads/feed/impression|click` — untrusted input с клиента
 * (тот же принцип, что `RecordAdEventDto` в `advertising` module):
 * несуществующий/чужой `assignmentId` не должен превращаться в 500, см.
 * `NativeAdCampaignsService.recordImpression/recordClick`'s try/catch.
 * `assignmentId`, не `campaignId` (Phase 4, AI_PLATFORM_ROADMAP.md §82) —
 * без него нельзя было бы приписать событие конкретному creator'у в
 * `NativeAdRevenueEvent`. */
export class RecordNativeAdEventDto {
  @IsString()
  @Length(1, 200)
  assignmentId!: string;
}
