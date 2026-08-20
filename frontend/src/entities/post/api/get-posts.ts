'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Post } from '../model/types';
import { mapPost, resolveInteractionTarget, type PostResponse } from './map-post';

/** Backend хранит и лайки/репосты текущего пользователя — исходные карты для post-store. */
export async function getPosts(): Promise<{
  posts: Post[];
  likedPostIds: Record<string, boolean>;
  repostedPostIds: Record<string, boolean>;
}> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const posts = await backendFetch<PostResponse[]>('/posts', { token });
  const likedPostIds: Record<string, boolean> = {};
  const repostedPostIds: Record<string, boolean> = {};
  posts.forEach((post) => {
    const target = resolveInteractionTarget(post);
    if (target.isLikedByMe) likedPostIds[target.id] = true;
    if (target.isRepostedByMe) repostedPostIds[target.id] = true;
  });

  return { posts: posts.map(mapPost), likedPostIds, repostedPostIds };
}
