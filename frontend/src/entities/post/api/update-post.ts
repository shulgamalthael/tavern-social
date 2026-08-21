'use server';

import { backendUpload } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Post } from '../model/types';
import { mapPost, type PostResponse } from './map-post';

/** Тот же контракт, что и `createPost` — см. комментарий там же. Какие
 * картинки остались, backend определяет сам по тому, какие `/uploads/
 * posts/...` src ещё есть в присланном `text` — здесь не нужен отдельный
 * список «что оставить». */
export async function updatePost(postId: string, text: string, images: File[]): Promise<Post> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const formData = new FormData();
  formData.append('text', text);
  images.forEach((image) => formData.append('images', image));

  const post = await backendUpload<PostResponse>(`/posts/${postId}`, {
    method: 'PATCH',
    token,
    formData,
  });
  return mapPost(post);
}
