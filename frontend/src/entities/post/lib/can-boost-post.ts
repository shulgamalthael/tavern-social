import type { Post } from '../model/types';

/**
 * Продвигать (Instagram-style boost, AI_PLATFORM_ROADMAP.md §73) можно
 * только собственную запись, ещё без активного продвижения — та же
 * авторская проверка, что и `canDeletePost` (не отдельная функция ради
 * DRY, а потому что смысл прямо разный: "может ли редактировать/удалить" и
 * "может ли начать новое продвижение" — совпадение первого условия
 * случайно, второе условие (`isPromoted`) у `canDeletePost` вообще не
 * существует).
 */
export function canBoostPost(post: Post, currentUserId: string): boolean {
  return post.authorId === currentUserId && !post.isPromoted;
}
