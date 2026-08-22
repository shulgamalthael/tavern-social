import type { Post } from '../model/types';

/**
 * «Передать дальше» доступно только для чужого контента — repost
 * собственной записи backend всё равно отклоняет (см. `PostsService.create`,
 * защита от self-repost), поэтому кнопку просто не показываем, а не оставляем
 * видимой, но фактически нерабочей. Для карточки репоста источник — автор
 * оригинала (`post.repostOf`), не автор самой карточки-обёртки: репостнуть
 * чужой репост своей же записи так же нельзя, как и сам оригинал.
 */
export function canRepostPost(post: Post, currentUserId: string): boolean {
  return (post.repostOf?.authorId ?? post.authorId) !== currentUserId;
}
