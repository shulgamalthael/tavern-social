'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { BlogPost } from '../model/types';

export async function getBlogPosts(businessId: string): Promise<BlogPost[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<BlogPost[]>(`/businesses/${businessId}/blog-posts`, { token });
}
