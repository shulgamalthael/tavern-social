'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AdminCreatorCategory, UpdateCreatorCategoryInput } from '../model/types';

export async function updateCreatorCategory(
  id: string,
  input: UpdateCreatorCategoryInput,
): Promise<AdminCreatorCategory> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<AdminCreatorCategory>(`/admin/creators/categories/${id}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}
