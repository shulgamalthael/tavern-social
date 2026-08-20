'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Group } from '../model/types';

interface GroupResponse {
  id: string;
  name: string;
  meta: string;
  mark: string;
  role: string;
}

export async function getGroups(): Promise<Group[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<GroupResponse[]>('/groups', { token });
}
