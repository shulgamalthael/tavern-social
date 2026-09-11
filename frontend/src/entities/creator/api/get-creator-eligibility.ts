'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CreatorEligibility } from '../model/types';

export async function getCreatorEligibility(): Promise<CreatorEligibility> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CreatorEligibility>('/creators/eligibility', { token });
}
