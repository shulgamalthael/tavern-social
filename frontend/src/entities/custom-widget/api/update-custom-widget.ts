'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CustomWidget, CustomWidgetStatus, WidgetBlockInput } from '../model/types';

export interface UpdateCustomWidgetInput {
  name?: string;
  schema?: WidgetBlockInput[];
  status?: CustomWidgetStatus;
}

export async function updateCustomWidget(
  businessId: string,
  widgetId: string,
  input: UpdateCustomWidgetInput,
): Promise<CustomWidget> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CustomWidget>(`/businesses/${businessId}/widgets/${widgetId}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}
