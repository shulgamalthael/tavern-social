'use server';

import { getInitials } from '@/shared/lib/get-initials';
import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AdminUser } from '../model/types';

export async function banUser(userId: string, reason?: string): Promise<AdminUser> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const user = await backendFetch<Omit<AdminUser, 'initials'>>(`/admin/users/${userId}/ban`, {
    method: 'POST',
    token,
    body: reason ? { reason } : {},
  });
  return { ...user, initials: getInitials(user.name) };
}
