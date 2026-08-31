'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AiInfrastructureOverview } from '../model/types';

export async function getAiInfrastructureOverview(): Promise<AiInfrastructureOverview> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<AiInfrastructureOverview>('/admin/ai-infrastructure/overview', { token });
}
