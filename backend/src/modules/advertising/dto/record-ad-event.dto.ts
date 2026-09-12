import { AdPlacement } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

/** Тело `POST /sites/:businessId/ads/impression|click` и `POST /feed-ads/
 * impression|click` — анонимный (сайт) или сессионный (лента) fire-and-
 * forget вызов после того, как креатив реально отрендерился/по нему
 * кликнули (см. `AdSlotRenderer` на frontend), не блокирует сам ответ
 * `ads/select`. */
export class RecordAdEventDto {
  @IsString()
  @Length(1, 100)
  campaignId!: string;

  @IsString()
  @Length(1, 100)
  creativeId!: string;

  /** Место, где РЕАЛЬНО произошёл этот показ/клик — нужно только
   * `AdCampaignsService.refreshClearingPrice` (второй-цена-аукцион, см.
   * её комментарий), не влияет на сам учёт показа/клика. Необязательно —
   * `FeedAdsController` игнорирует это поле целиком и всегда передаёт
   * сервису захардкоженный `'feed_sidebar'` (клиенту ленты незачем это
   * знать/присылать), `PublicSitesController` передаёт его дальше как
   * есть; отсутствие значения там просто пропускает пересчёт цены на этот
   * конкретный показ (учёт самого показа/клика всё равно происходит). */
  @IsOptional()
  @IsEnum(AdPlacement, { message: 'Недопустимое место размещения' })
  placement?: AdPlacement;
}
