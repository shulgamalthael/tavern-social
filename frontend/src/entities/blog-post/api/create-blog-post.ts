'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { BlogPost } from '../model/types';

export interface CreateBlogPostInput {
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  coverImage?: string | null;
  isPublished?: boolean;
  seoTitle?: string;
  seoDescription?: string;
}

export async function createBlogPost(
  businessId: string,
  input: CreateBlogPostInput,
): Promise<BlogPost> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<BlogPost>(`/businesses/${businessId}/blog-posts`, {
    method: 'POST',
    token,
    body: input,
  });
}
