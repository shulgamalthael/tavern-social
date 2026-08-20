'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Post } from '../model/types';
import { mapPost, type PostResponse } from './map-post';

export interface RepostToggleResponse {
  original: PostResponse;
  repost: PostResponse | null;
  removedRepostId: string | null;
}

export interface ToggleRepostResult {
  reposts: number;
  isRepostedByMe: boolean;
  /** Новая карточка репоста для вставки в ленту — только при создании. */
  newPost: Post | null;
  /** Id карточки репоста, которую нужно убрать из ленты — только при отмене. */
  removedPostId: string | null;
}

export async function togglePostRepost(
  postId: string,
  repost: boolean,
): Promise<ToggleRepostResult> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const result = await backendFetch<RepostToggleResponse>(`/posts/${postId}/reposts`, {
    method: repost ? 'POST' : 'DELETE',
    token,
  });

  return {
    reposts: result.original.repostsCount,
    isRepostedByMe: result.original.isRepostedByMe,
    newPost: result.repost ? mapPost(result.repost) : null,
    removedPostId: result.removedRepostId,
  };
}
