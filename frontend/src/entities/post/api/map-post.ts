import { getInitials } from '@/shared/lib/get-initials';
import { formatRelativeTime } from '@/shared/lib/format-relative-time';
import type { FeedKind, LinkPreview, Post } from '../model/types';

export interface PostAuthorResponse {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface LinkPreviewResponse {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  domain: string | null;
}

export interface PostSummaryResponse {
  id: string;
  author: PostAuthorResponse;
  wallOwnerId: string | null;
  wallOwnerName: string | null;
  groupId: string | null;
  groupName: string | null;
  text: string;
  images: string[];
  linkPreviews: LinkPreviewResponse[];
  createdAt: string;
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  repostsCount: number;
  isLikedByMe: boolean;
  isDislikedByMe: boolean;
  isRepostedByMe: boolean;
}

export interface PostResponse {
  id: string;
  author: PostAuthorResponse;
  wallOwnerId: string | null;
  wallOwnerName: string | null;
  groupId: string | null;
  groupName: string | null;
  kind: FeedKind;
  text: string;
  images: string[];
  linkPreviews: LinkPreviewResponse[];
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  repostsCount: number;
  isLikedByMe: boolean;
  isDislikedByMe: boolean;
  isRepostedByMe: boolean;
  isPromoted: boolean;
  promotedUntil: string | null;
  createdAt: string;
  repostOf: PostSummaryResponse | null;
}

function mapLinkPreviews(previews: LinkPreviewResponse[]): LinkPreview[] {
  return previews.map((preview) => ({
    url: preview.url,
    title: preview.title,
    description: preview.description,
    imageUrl: preview.imageUrl,
    domain: preview.domain,
  }));
}

/**
 * Лайк/дизлайк/ответ/повторный репост на карточке репоста всегда
 * применяются к оригиналу — это единственное место, где решается, «чей» id
 * и статистика идут в интерактив карточки (см. AGENTS.md, раздел про репосты).
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
    authorAvatarUrl: post.author.avatarUrl,
    meta: formatRelativeTime(post.createdAt),
    wallOwnerId: post.wallOwnerId,
    wallOwnerName: post.wallOwnerName,
    groupId: post.groupId,
    groupName: post.groupName,
    kind: post.kind,
    text: post.text,
    images: post.images,
    linkPreviews: mapLinkPreviews(post.linkPreviews),
    likes: target.likesCount,
    dislikes: target.dislikesCount,
    comments: target.commentsCount,
    reposts: target.repostsCount,
    isPromoted: post.isPromoted,
    promotedUntil: post.promotedUntil,
    repostOf: post.repostOf
      ? {
          id: post.repostOf.id,
          authorId: post.repostOf.author.id,
          author: post.repostOf.author.name,
          initials: getInitials(post.repostOf.author.name),
          authorAvatarUrl: post.repostOf.author.avatarUrl,
          meta: formatRelativeTime(post.repostOf.createdAt),
          groupId: post.repostOf.groupId,
          groupName: post.repostOf.groupName,
          text: post.repostOf.text,
          images: post.repostOf.images,
          linkPreviews: mapLinkPreviews(post.repostOf.linkPreviews),
        }
      : undefined,
  };
}
