import type { Comment } from '../model/comment-types';

/** Кнопка «Удалить» у комментария — только для собственного (см.
 * `PostsService.removeComment` на backend, та же проверка авторства). */
export function canDeleteComment(comment: Comment, currentUserId: string): boolean {
  return comment.authorId === currentUserId;
}
