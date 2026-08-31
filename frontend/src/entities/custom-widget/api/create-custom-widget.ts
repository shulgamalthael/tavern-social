'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CustomWidget, WidgetBlockInput } from '../model/types';

export interface CreateCustomWidgetInput {
  name: string;
  schema: WidgetBlockInput[];
}

export async function createCustomWidget(
  businessId: string,
  input: CreateCustomWidgetInput,
): Promise<CustomWidget> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CustomWidget>(`/businesses/${businessId}/widgets`, {
    method: 'POST',
    token,
    body: input,
  });
}
