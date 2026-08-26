'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { MediaAsset } from '../model/types';

export async function getMediaAssets(businessId: string): Promise<MediaAsset[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<MediaAsset[]>(`/businesses/${businessId}/media`, { token });
}
