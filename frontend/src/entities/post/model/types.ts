export type FeedKind = 'friends' | 'communities' | 'events';

/** Превью внешней ссылки, найденной в `text` поста — см. LinkPreviewCard. */
export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  domain: string | null;
}

/**
 * Сводка оригинального поста внутри репоста — только то, что нужно для
 * отображения «цитаты» под репостом (см. PostCard). Лайк/ответ/повторный
 * репост на карточке репоста всегда применяются к оригиналу (его `id`),
 * а не к этой обёрточной записи.
 */
export interface RepostSummary {
  id: string;
  authorId: string;
  author: string;
  initials: string;
  authorAvatarUrl: string | null;
  meta: string;
  /** Пост-оригинал опубликован в группе — см. Post.groupId. */
  groupId: string | null;
  groupName: string | null;
  /** Санитизированный HTML — см. Post.text. */
  text: string;
  /** URL картинок, встреченных в `text`, в порядке появления — только для
   * `ImageLightbox` (клик по инлайн-картинке), не отдельное представление
   * контента. */
  images: string[];
  linkPreviews: LinkPreview[];
}

export interface Post {
  id: string;
  authorId: string;
  author: string;
  initials: string;
  authorAvatarUrl: string | null;
  meta: string;
  /** Чья это стена — обычно совпадает с authorId (свой пост на своей
   * стене), но может отличаться, если пост написан на чужой стене. `null`,
   * если пост опубликован в группе (см. groupId) — ровно одно из двух полей
   * заполнено. */
  wallOwnerId: string | null;
  wallOwnerName: string | null;
  /** Пост опубликован в группе — альтернатива wallOwnerId, см. выше. */
  groupId: string | null;
  groupName: string | null;
  kind: FeedKind;
  /** Санитизированный на backend HTML (см. common/lib/sanitize-post-content.ts
   * в backend) — единственный источник и текста, и позиции картинок внутри
   * поста. Безопасен для `dangerouslySetInnerHTML` именно потому, что уже
   * прошёл санитизацию на сервере, а не потому, что frontend его чем-то
   * дополнительно чистит. */
  text: string;
  /** URL картинок, встреченных в `text`, в порядке появления — см.
   * RepostSummary.images. */
  images: string[];
  linkPreviews: LinkPreview[];
  likes: number;
  dislikes: number;
  comments: number;
  reposts: number;
  /** Продвижение (Instagram-style boost, AI_PLATFORM_ROADMAP.md §73) —
   * `true`, пока у поста есть оплаченное продвижение с `promotedUntil` в
   * будущем. Это единственная причина, по которой пост может оказаться в
   * ленте у того, кто не друг автору и не состоит в его сообществе (см.
   * backend `PostsService.listFeed`). */
  isPromoted: boolean;
  /** `null`, если `isPromoted: false`. */
  promotedUntil: string | null;
  repostOf?: RepostSummary;
}
