'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Comment } from '../model/comment-types';
import { mapComment, type CommentResponse } from './map-comment';

interface CommentsPageResponse {
  items: CommentResponse[];
  nextCursor: string | null;
}

export async function getComments(
  postId: string,
  cursor?: string | null,
): Promise<{ comments: Comment[]; nextCursor: string | null }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { items, nextCursor } = await backendFetch<CommentsPageResponse>(
    `/posts/${postId}/comments${query}`,
    { token },
  );
  return { comments: items.map(mapComment), nextCursor };
}
