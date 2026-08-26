'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { BlogPost } from '../model/types';
import type { CreateBlogPostInput } from './create-blog-post';

export type UpdateBlogPostInput = Partial<CreateBlogPostInput>;

export async function updateBlogPost(
  businessId: string,
  postId: string,
  input: UpdateBlogPostInput,
): Promise<BlogPost> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<BlogPost>(`/businesses/${businessId}/blog-posts/${postId}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}
