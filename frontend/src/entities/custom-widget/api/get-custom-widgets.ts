'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CustomWidget } from '../model/types';

export async function getCustomWidgets(businessId: string): Promise<CustomWidget[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CustomWidget[]>(`/businesses/${businessId}/widgets`, { token });
}
