'use server';

import { getInitials } from '@/shared/lib/get-initials';
import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type {
  AdminUser,
  AdminUsersPage,
  AdminUserRoleFilter,
  AdminUserStatusFilter,
} from '../model/types';

interface AdminUsersResponse {
  items: Omit<AdminUser, 'initials'>[];
  nextCursor: string | null;
}

export interface GetAdminUsersOptions {
  cursor?: string | null;
  search?: string;
  role?: AdminUserRoleFilter;
  status?: AdminUserStatusFilter;
}

export async function getAdminUsers(options: GetAdminUsersOptions = {}): Promise<AdminUsersPage> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const params = new URLSearchParams();
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.search) params.set('search', options.search);
  if (options.role && options.role !== 'all') params.set('role', options.role);
  if (options.status && options.status !== 'all') params.set('status', options.status);
  const query = params.toString() ? `?${params.toString()}` : '';

  const response = await backendFetch<AdminUsersResponse>(`/admin/users${query}`, { token });
  return {
    items: response.items.map((user) => ({ ...user, initials: getInitials(user.name) })),
    nextCursor: response.nextCursor,
  };
}
