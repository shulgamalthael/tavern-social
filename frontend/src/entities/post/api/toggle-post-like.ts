'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import { mapPost, type PostResponse } from './map-post';

export interface ToggleLikeResult {
  likes: number;
  dislikes: number;
  isLikedByMe: boolean;
  isDislikedByMe: boolean;
}

/** Лайк/дизлайк взаимоисключающие на backend (единая реакция) — ставя лайк
 * поверх активного дизлайка, ответ уже несёт `isDislikedByMe: false`. */
export async function togglePostLike(postId: string, like: boolean): Promise<ToggleLikeResult> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const post = await backendFetch<PostResponse>(`/posts/${postId}/likes`, {
    method: like ? 'POST' : 'DELETE',
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
