'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

export interface SetAiBudgetInput {
  scope: 'global' | 'business';
  businessId?: string;
  monthlyLimitCents: number;
}

export async function setAiBudget(input: SetAiBudgetInput): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  await backendFetch<void>('/admin/ai-infrastructure/budgets', {
    method: 'POST',
    token,
    body: input,
  });
}
