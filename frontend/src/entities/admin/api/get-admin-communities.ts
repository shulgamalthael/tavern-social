'use server';

import { getInitials } from '@/shared/lib/get-initials';
import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AdminCommunitiesPage, AdminCommunity } from '../model/types';

interface AdminCommunitiesResponse {
  items: Omit<AdminCommunity, 'initials'>[];
  nextCursor: string | null;
}

export interface GetAdminCommunitiesOptions {
  cursor?: string | null;
  search?: string;
}

export async function getAdminCommunities(
  options: GetAdminCommunitiesOptions = {},
): Promise<AdminCommunitiesPage> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const params = new URLSearchParams();
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.search) params.set('search', options.search);
  const query = params.toString() ? `?${params.toString()}` : '';

  const response = await backendFetch<AdminCommunitiesResponse>(`/admin/communities${query}`, {
    token,
  });
  return {
    items: response.items.map((community) => ({
      ...community,
      initials: getInitials(community.name),
    })),
    nextCursor: response.nextCursor,
  };
}
