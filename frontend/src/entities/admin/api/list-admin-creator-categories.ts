'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AdminCreatorCategory } from '../model/types';

export async function listAdminCreatorCategories(): Promise<AdminCreatorCategory[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<AdminCreatorCategory[]>('/admin/creators/categories', { token });
}
