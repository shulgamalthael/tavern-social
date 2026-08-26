'use server';

import { getInitials } from '@/shared/lib/get-initials';
import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AdminUser } from '../model/types';

/** Доступно только текущему супер-админу — backend это же и проверяет
 * (`SuperAdminGuard`), здесь просто вызов, без дублирования проверки. */
export async function setSuperAdmin(userId: string, isSuperAdmin: boolean): Promise<AdminUser> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const user = await backendFetch<Omit<AdminUser, 'initials'>>(
    `/admin/users/${userId}/super-admin`,
    { method: 'PATCH', token, body: { isSuperAdmin } },
  );
  return { ...user, initials: getInitials(user.name) };
}
