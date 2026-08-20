'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Post } from '../model/types';
import { mapPost, type PostResponse } from './map-post';

export async function createPost(text: string): Promise<Post> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const post = await backendFetch<PostResponse>('/posts', {
    method: 'POST',
    token,
    body: { text },
  });
  return mapPost(post);
}
