'use server';

import { getInitials } from '@/shared/lib/get-initials';
import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type {
  AdminPost,
  AdminPostLocationFilter,
  AdminPostsPage,
  AdminPostTypeFilter,
} from '../model/types';

interface AdminPostsResponse {
  items: Omit<AdminPost, 'authorInitials'>[];
  nextCursor: string | null;
}

export interface GetAdminPostsOptions {
  cursor?: string | null;
  search?: string;
  type?: AdminPostTypeFilter;
  location?: AdminPostLocationFilter;
}

export async function getAdminPosts(options: GetAdminPostsOptions = {}): Promise<AdminPostsPage> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const params = new URLSearchParams();
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.search) params.set('search', options.search);
  if (options.type && options.type !== 'all') params.set('type', options.type);
  if (options.location && options.location !== 'all') params.set('location', options.location);
  const query = params.toString() ? `?${params.toString()}` : '';

  const response = await backendFetch<AdminPostsResponse>(`/admin/posts${query}`, { token });
  return {
    items: response.items.map((post) => ({
      ...post,
      authorInitials: getInitials(post.authorName),
    })),
    nextCursor: response.nextCursor,
  };
}
