'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Comment } from '../model/comment-types';
import { mapComment, type CommentResponse } from './map-comment';

export async function createComment(postId: string, text: string): Promise<Comment> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const comment = await backendFetch<CommentResponse>(`/posts/${postId}/comments`, {
    method: 'POST',
    token,
    body: { text },
  });
  return mapComment(comment);
}
