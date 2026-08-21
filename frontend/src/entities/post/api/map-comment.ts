import { getInitials } from '@/shared/lib/get-initials';
import { formatRelativeTime } from '@/shared/lib/format-relative-time';
import type { Comment } from '../model/comment-types';

export interface CommentAuthorResponse {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface CommentResponse {
  id: string;
  postId: string;
  parentId: string | null;
  author: CommentAuthorResponse;
  text: string;
  createdAt: string;
}

export function mapComment(comment: CommentResponse): Comment {
  return {
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId,
    authorId: comment.author.id,
    author: comment.author.name,
    initials: getInitials(comment.author.name),
    avatarUrl: comment.author.avatarUrl,
    meta: formatRelativeTime(comment.createdAt),
    text: comment.text,
  };
}
