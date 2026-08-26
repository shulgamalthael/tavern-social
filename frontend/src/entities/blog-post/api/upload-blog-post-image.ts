'use server';

import { backendUpload } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

export async function uploadBlogPostImage(
  businessId: string,
  file: Blob,
): Promise<{ url: string }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const formData = new FormData();
  formData.append('file', file, 'blog-post.jpg');

  return backendUpload<{ url: string }>(`/businesses/${businessId}/blog-posts/images`, {
    token,
    formData,
  });
}
