'use server';

import { getInitials } from '@/shared/lib/get-initials';
import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AdminGroup, AdminGroupsPage } from '../model/types';

interface AdminGroupsResponse {
  items: Omit<AdminGroup, 'initials'>[];
  nextCursor: string | null;
}

export interface GetAdminGroupsOptions {
  cursor?: string | null;
  search?: string;
}

export async function getAdminGroups(
  options: GetAdminGroupsOptions = {},
): Promise<AdminGroupsPage> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const params = new URLSearchParams();
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.search) params.set('search', options.search);
  const query = params.toString() ? `?${params.toString()}` : '';

  const response = await backendFetch<AdminGroupsResponse>(`/admin/groups${query}`, { token });
  return {
    items: response.items.map((group) => ({ ...group, initials: getInitials(group.name) })),
    nextCursor: response.nextCursor,
  };
}
