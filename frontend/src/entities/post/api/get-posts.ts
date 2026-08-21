'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Post } from '../model/types';
import { mapPost, resolveInteractionTarget, type PostResponse } from './map-post';

interface PostsPageResponse {
  items: PostResponse[];
  nextCursor: string | null;
}

/** Backend хранит и реакции/репосты текущего пользователя — исходные карты для post-store. */
export async function getPosts(cursor?: string | null): Promise<{
  posts: Post[];
  nextCursor: string | null;
  likedPostIds: Record<string, boolean>;
  dislikedPostIds: Record<string, boolean>;
  repostedPostIds: Record<string, boolean>;
}> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { items, nextCursor } = await backendFetch<PostsPageResponse>(`/posts${query}`, { token });
  const likedPostIds: Record<string, boolean> = {};
  const dislikedPostIds: Record<string, boolean> = {};
  const repostedPostIds: Record<string, boolean> = {};
  items.forEach((post) => {
    const target = resolveInteractionTarget(post);
    if (target.isLikedByMe) likedPostIds[target.id] = true;
    if (target.isDislikedByMe) dislikedPostIds[target.id] = true;
    if (target.isRepostedByMe) repostedPostIds[target.id] = true;
  });

  return { posts: items.map(mapPost), nextCursor, likedPostIds, dislikedPostIds, repostedPostIds };
}
