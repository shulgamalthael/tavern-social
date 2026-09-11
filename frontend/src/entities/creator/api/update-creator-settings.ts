'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CreatorProfile, UpdateCreatorSettingsInput } from '../model/types';

export async function updateCreatorSettings(
  input: UpdateCreatorSettingsInput,
): Promise<CreatorProfile> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CreatorProfile>('/creators/settings', {
    method: 'PATCH',
    token,
    body: input,
  });
}
