'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { PrivacySettings } from '../model/types';

interface MeProfileResponse {
  settings: PrivacySettings;
}

/** Настройки приватности видны только на странице «Настройки» — не общий store. */
export async function getMySettings(): Promise<PrivacySettings> {
  const token = await getSessionToken();
  if (!token) {
    throw new Error('Сессия истекла — обновите страницу');
  }

  const profile = await backendFetch<MeProfileResponse>('/users/me', { token });
  return profile.settings;
}
