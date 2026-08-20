import { getInitials } from '@/shared/lib/get-initials';
import { formatRelativeTime } from '@/shared/lib/format-relative-time';
import type { FeedKind, Post } from '../model/types';

export interface PostAuthorResponse {
  id: string;
  name: string;
}

export interface PostSummaryResponse {
  id: string;
  author: PostAuthorResponse;
  text: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  isLikedByMe: boolean;
  isRepostedByMe: boolean;
}

export interface PostResponse {
  id: string;
  author: PostAuthorResponse;
  kind: FeedKind;
  text: string;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  repostsCount: number;
  isLikedByMe: boolean;
  isRepostedByMe: boolean;
  createdAt: string;
  repostOf: PostSummaryResponse | null;
}

/**
 * Лайк/ответ/повторный репост на карточке репоста всегда применяются к
 * оригиналу — это единственное место, где решается, «чей» id и статистика
 * идут в интерактив карточки (см. AGENTS.md, раздел про репосты).
 */
export function resolveInteractionTarget(post: PostResponse): PostSummaryResponse | PostResponse {
  return post.repostOf ?? post;
}

export function mapPost(post: PostResponse): Post {
  const target = resolveInteractionTarget(post);

  return {
    id: post.id,
    authorId: post.author.id,
    author: post.author.name,
    initials: getInitials(post.author.name),
    meta: formatRelativeTime(post.createdAt),
    kind: post.kind,
    text: post.text,
    likes: target.likesCount,
    comments: target.commentsCount,
    reposts: target.repostsCount,
    views: String(post.viewsCount),
    repostOf: post.repostOf
      ? {
          id: post.repostOf.id,
          author: post.repostOf.author.name,
          initials: getInitials(post.repostOf.author.name),
          meta: formatRelativeTime(post.repostOf.createdAt),
          text: post.repostOf.text,
        }
      : undefined,
  };
}
