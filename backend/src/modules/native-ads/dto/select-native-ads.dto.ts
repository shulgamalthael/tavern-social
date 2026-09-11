import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from 'class-validator';

/** Тело `POST native-ads/feed/select` — id постов, уже загруженных viewer'ом
 * на клиенте (одна страница ленты), НЕ произвольный запрос "дай рекламу":
 * движок (`NativeAdFeedService.getAdsForPosts`) сам решает, у каких из этих
 * постов есть основание показать рекламу (автор — активный монетизированный
 * creator, пейсинг по `maxAdFrequencyRatio`), см. её комментарий. */
export class SelectNativeAdsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  postIds!: string[];
}
