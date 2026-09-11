'use server';

import type { CreatorStatus } from '@/entities/creator';
import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AdminCreatorListItem } from '../model/types';

export async function getAdminCreators(status?: CreatorStatus): Promise<AdminCreatorListItem[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const query = status ? `?status=${status}` : '';
  return backendFetch<AdminCreatorListItem[]>(`/admin/creators${query}`, { token });
}
