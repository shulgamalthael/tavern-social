'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CreatorCategoryNode } from '../model/types';

export async function getCreatorCategories(): Promise<CreatorCategoryNode[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CreatorCategoryNode[]>('/creators/categories', { token });
}
