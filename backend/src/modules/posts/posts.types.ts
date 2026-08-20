import type { PostKind } from '@prisma/client';
import type { PublicProfile } from '@/modules/users/users.types';

/**
 * Сводка оригинального поста внутри репоста. Достаточно полная, чтобы
 * frontend не делал второй запрос за состоянием оригинала (лайкнут ли он
 * мной, сколько у него реакций) — все действия над репостом в ленте
 * (лайк/ответ/повторный репост) применяются именно к оригиналу, см.
 * AGENTS.md, раздел про репосты.
 */
export interface PostSummaryDto {
  id: string;
  author: PublicProfile;
  /// Чья это стена — см. PostDto.wallOwnerId.
  wallOwnerId: string;
  wallOwnerName: string;
  text: string;
  createdAt: string;
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  repostsCount: number;
  isLikedByMe: boolean;
  isDislikedByMe: boolean;
}

export interface PostDto {
  id: string;
  author: PublicProfile;
  /** Чья это стена — обычно совпадает с author.id, но может отличаться,
   * если пост написан на чужой стене (см. PostsService.create). */
  wallOwnerId: string;
  wallOwnerName: string;
  kind: PostKind;
  text: string;
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  viewsCount: number;
  repostsCount: number;
  isLikedByMe: boolean;
  isDislikedByMe: boolean;
  createdAt: string;
  repostOf: PostSummaryDto | null;
}

export interface CommentDto {
  id: string;
  postId: string;
  /** null — комментарий верхнего уровня; иначе — id комментария верхнего
   * уровня, на который отвечают (один уровень вложенности, см. AGENTS.md). */
  parentId: string | null;
  author: PublicProfile;
  text: string;
  createdAt: string;
}
