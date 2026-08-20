'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { GalleryImage } from '../model/types';

export async function getGallery(userId: string): Promise<GalleryImage[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<GalleryImage[]>(`/users/${userId}/gallery`, { token });
}
