'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CreatorProfile, StartCreatorOnboardingInput } from '../model/types';

export async function startCreatorOnboarding(
  input: StartCreatorOnboardingInput,
): Promise<CreatorProfile> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CreatorProfile>('/creators/onboarding', {
    method: 'POST',
    token,
    body: input,
  });
}
