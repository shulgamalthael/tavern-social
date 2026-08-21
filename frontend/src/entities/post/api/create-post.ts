'use server';

import { backendUpload } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Post } from '../model/types';
import { mapPost, type PostResponse } from './map-post';

/** `text` — уже финализированный HTML (плейсхолдеры `attachment:N` вместо
 * `blob:`-превью, см. `features/publish-post/ui/PostEditor.tsx`), `images` —
 * файлы в том же порядке, что и индексы плейсхолдеров. Один multipart-запрос
 * — файлы не грузятся, пока пользователь не нажал «Опубликовать» (см. план
 * задачи, раздел про orphaned-файлы). */
export async function createPost(
  text: string,
  images: File[],
  wallOwnerId?: string,
  groupId?: string,
): Promise<Post> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const formData = new FormData();
  formData.append('text', text);
  // Взаимоисключающе — см. CreatePostDto на backend.
  if (groupId) formData.append('groupId', groupId);
  else if (wallOwnerId) formData.append('wallOwnerId', wallOwnerId);
  images.forEach((image) => formData.append('images', image));

  const post = await backendUpload<PostResponse>('/posts', { token, formData });
  return mapPost(post);
}
