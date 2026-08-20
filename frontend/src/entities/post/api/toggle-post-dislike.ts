'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import { mapPost, type PostResponse } from './map-post';

export interface ToggleDislikeResult {
  likes: number;
  dislikes: number;
  isLikedByMe: boolean;
  isDislikedByMe: boolean;
}

/** Лайк/дизлайк взаимоисключающие на backend (единая реакция) — ставя
 * дизлайк, ответ уже несёт актуальное `isLikedByMe: false`, если до этого
 * был лайк, поэтому store сверяет оба флага из одного ответа. */
export async function togglePostDislike(
  postId: string,
  dislike: boolean,
): Promise<ToggleDislikeResult> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const post = await backendFetch<PostResponse>(`/posts/${postId}/dislikes`, {
    method: dislike ? 'POST' : 'DELETE',
    token,
  });
  const mapped = mapPost(post);
  return {
    likes: mapped.likes,
    dislikes: mapped.dislikes,
    isLikedByMe: post.isLikedByMe,
    isDislikedByMe: post.isDislikedByMe,
  };
}
