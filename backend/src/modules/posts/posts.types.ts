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
  text: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  isLikedByMe: boolean;
  isRepostedByMe: boolean;
}

export interface PostDto {
  id: string;
  author: PublicProfile;
  kind: PostKind;
  text: string;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  repostsCount: number;
  isLikedByMe: boolean;
  isRepostedByMe: boolean;
  createdAt: string;
  repostOf: PostSummaryDto | null;
}

export interface CommentDto {
  id: string;
  postId: string;
  author: PublicProfile;
  text: string;
  createdAt: string;
}
