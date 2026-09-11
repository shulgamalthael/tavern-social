import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** `?count=` — `GET /feed-ads/select` (`FeedAdsController`). Место
 * размещения НЕ приходит от клиента, в отличие от `SelectAdQueryDto` —
 * этот эндпоинт обслуживает только один плейсмент (`AdPlacement.
 * feed_sidebar`, см. `FeedAdsController`'s комментарий), поэтому нечего
 * валидировать/незачем позволять клиенту запросить чужой плейсмент без
 * паблишера. */
export class SelectFeedAdsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'count должен быть целым числом' })
  @Min(1)
  @Max(5)
  count?: number;
}
