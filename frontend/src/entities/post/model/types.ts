export type FeedKind = 'friends' | 'communities' | 'events';

/**
 * Сводка оригинального поста внутри репоста — только то, что нужно для
 * отображения «цитаты» под репостом (см. PostCard). Лайк/ответ/повторный
 * репост на карточке репоста всегда применяются к оригиналу (его `id`),
 * а не к обёрточной записи репоста.
 */
export interface RepostSummary {
  id: string;
  author: string;
  initials: string;
  meta: string;
  text: string;
}

export interface Post {
  id: string;
  authorId: string;
  author: string;
  initials: string;
  meta: string;
  kind: FeedKind;
  text: string;
  likes: number;
  comments: number;
  reposts: number;
  views: string;
  repostOf?: RepostSummary;
}
