import { getInitials } from '@/shared/lib/get-initials';
import { formatRelativeTime } from '@/shared/lib/format-relative-time';
import type { Comment } from '../model/comment-types';

export interface CommentAuthorResponse {
  id: string;
  name: string;
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
    author: comment.author.name,
    initials: getInitials(comment.author.name),
    meta: formatRelativeTime(comment.createdAt),
    text: comment.text,
  };
}
